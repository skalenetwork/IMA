// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxERC20.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/DoubleEndedQueueUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@skalenetwork/ima-interfaces/mainnet/DepositBoxes/IDepositBoxERC20.sol";

import "../../Messages.sol";
import "../DepositBox.sol";

interface IERC20TransferVoid {
    function transferFrom(address _from, address _to, uint256 _amount) external;
    function transfer(address _to, uint256 _amount) external;
}


/**
 * @title DepositBoxERC20
 * @dev Runs on mainnet,
 * accepts messages from schain,
 * stores deposits of ERC20.
 */
contract DepositBoxERC20 is DepositBox, IDepositBoxERC20 {
    using AddressUpgradeable for address;
    using DoubleEndedQueueUpgradeable for DoubleEndedQueueUpgradeable.Bytes32Deque;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    enum DelayedTransferStatus {
        DELAYED,
        ARBITRAGE,
        COMPLETED
    }

    struct DelayedTransfer {
        address receiver;
        bytes32 schainHash;
        address token;
        uint256 amount;
        uint256 untilTimestamp;
        DelayedTransferStatus status;
    }

    address private constant _USDT_ADDRESS = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    uint256 private constant _QUEUE_PROCESSING_LIMIT = 10;

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    bytes32 public constant TRUSTED_RECEIVER_ROLE = keccak256("TRUSTED_RECEIVER_ROLE");

    // schainHash => address of ERC20 on Mainnet
    mapping(bytes32 => mapping(address => bool)) private _deprecatedSchainToERC20;
    mapping(bytes32 => mapping(address => uint256)) public transferredAmount;
    mapping(bytes32 => EnumerableSetUpgradeable.AddressSet) private _schainToERC20;

    // exits delay configuration
    //   schainHash =>   token address => value
    mapping(bytes32 => mapping(address => uint256)) public bigTransferThreshold;
    //   schainHash => time delay in seconds
    mapping(bytes32 => uint256) public transferDelay;
    //   schainHash => time delay in seconds
    mapping(bytes32 => uint256) public arbitrageDuration;

    uint256 public delayedTransfersSize;
    // delayed transfer id => delayed transfer
    mapping(uint256 => DelayedTransfer) public delayedTransfers;
    // receiver address => delayed transfers ids queue
    mapping(address => DoubleEndedQueueUpgradeable.Bytes32Deque) public delayedTransfersByReceiver;    

    /**
     * @dev Emitted when token is mapped in DepositBoxERC20.
     */
    event ERC20TokenAdded(string schainName, address indexed contractOnMainnet);
    
    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(address indexed contractOnMainnet, uint256 amount);

    /**
     * @dev Allows DEFAULT_ADMIN_ROLE to initialize token mapping
     * Notice - this function will be executed only once during upgrade
     * 
     * Requirements:
     * 
     * `msg.sender` should has DEFAULT_ADMIN_ROLE
     */
    function initializeAllTokensForSchain(
        string calldata schainName,
        address[] calldata tokens
    )
        external
        override
    {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not authorized");
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        for (uint256 i = 0; i < tokens.length; i++) {
            if (_deprecatedSchainToERC20[schainHash][tokens[i]] && !_schainToERC20[schainHash].contains(tokens[i])) {
                _schainToERC20[schainHash].add(tokens[i]);
                delete _deprecatedSchainToERC20[schainHash][tokens[i]];
            }
        }
    }

    /**
     * @dev Allows `msg.sender` to send ERC20 token from mainnet to schain
     * 
     * Requirements:
     * 
     * - Schain name must not be `Mainnet`.
     * - Receiver account on schain cannot be null.
     * - Schain that receives tokens should not be killed.
     * - Receiver contract should be defined.
     * - `msg.sender` should approve their tokens for DepositBoxERC20 address.
     */
    function depositERC20(
        string calldata schainName,
        address erc20OnMainnet,
        uint256 amount
    )
        external
        override
        rightTransaction(schainName, msg.sender)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            ERC20Upgradeable(erc20OnMainnet).allowance(msg.sender, address(this)) >= amount,
            "DepositBox was not approved for ERC20 token"
        );
        bytes memory data = _receiveERC20(
            schainName,
            erc20OnMainnet,
            msg.sender,
            amount
        );
        _saveTransferredAmount(schainHash, erc20OnMainnet, amount);
        if (erc20OnMainnet == _USDT_ADDRESS) {
            // solhint-disable-next-line no-empty-blocks
            try IERC20TransferVoid(erc20OnMainnet).transferFrom(msg.sender, address(this), amount) {} catch {
                revert("Transfer was failed");
            }
        } else {
            require(
                ERC20Upgradeable(erc20OnMainnet).transferFrom(
                    msg.sender,
                    address(this),
                    amount
                ),
                "Transfer was failed"
            );
        }
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    /**
     * @dev Allows MessageProxyForMainnet contract to execute transferring ERC20 token from schain to mainnet.
     * 
     * Requirements:
     * 
     * - Schain from which the tokens came should not be killed.
     * - Sender contract should be defined and schain name cannot be `Mainnet`.
     * - Amount of tokens on DepositBoxERC20 should be equal or more than transferred amount.
     */
    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        whenNotKilled(schainHash)
        checkReceiverChain(schainHash, sender)
    {
        Messages.TransferErc20Message memory message = Messages.decodeTransferErc20Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(ERC20Upgradeable(message.token).balanceOf(address(this)) >= message.amount, "Not enough money");
        _removeTransferredAmount(schainHash, message.token, message.amount);

        uint256 delay = transferDelay[schainHash];
        if (
            delay > 0
            && message.amount > bigTransferThreshold[schainHash][message.token]
            && !hasRole(TRUSTED_RECEIVER_ROLE, message.receiver)
        ) {
            uint256 delayId = delayedTransfersSize++;
            delayedTransfers[delayId] = DelayedTransfer({
                receiver: message.receiver,
                schainHash: schainHash,
                token: message.token,
                amount: message.amount,
                untilTimestamp: block.timestamp + delay,
                status: DelayedTransferStatus.DELAYED
            });
            _addToDelayedQueue(message.receiver, delayId, block.timestamp + delay);
        } else {
            _transfer(message.token, message.receiver, message.amount);
        }
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to DepositBoxERC20.
     * 
     * Emits an {ERC20TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Schain should not be killed.
     * - Only owner of the schain able to run function.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet)
        external
        override
        onlySchainOwner(schainName)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        _addERC20ForSchain(schainName, erc20OnMainnet);
    }

    /**
     * @dev Allows Schain owner to return each user their tokens.
     * The Schain owner decides which tokens to send to which address, 
     * since the contract on mainnet does not store information about which tokens belong to whom.
     *
     * Requirements:
     * 
     * - Amount of tokens on schain should be equal or more than transferred amount.
     * - msg.sender should be an owner of schain
     * - IMA transfers Mainnet <-> schain should be killed
     */
    function getFunds(string calldata schainName, address erc20OnMainnet, address receiver, uint amount)
        external
        override
        onlySchainOwner(schainName)
        whenKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(transferredAmount[schainHash][erc20OnMainnet] >= amount, "Incorrect amount");
        _removeTransferredAmount(schainHash, erc20OnMainnet, amount);
        require(
            ERC20Upgradeable(erc20OnMainnet).transfer(receiver, amount),
            "Transfer was failed"
        );
    }

    /**
     * @dev Set a threshold amount of tokens.
     * If amount of tokens that exits IMA is bigger than the threshold
     * the transfer is delayed for configurable amount of time
     * and can be canceled by a voting
     *
     * Requirements:
     * 
     * - msg.sender should be an owner of schain
     */
    function setBigTransferValue(
        string calldata schainName,
        address token,
        uint256 value
    )
        external
        override
        onlySchainOwner(schainName)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        bigTransferThreshold[schainHash][token] = value;   
    }

    /**
     * @dev Set a time delay.
     * If amount of tokens that exits IMA is bigger than a threshold
     * the transfer is delayed for set amount of time
     * and can be canceled by a voting
     *
     * Requirements:
     * 
     * - msg.sender should be an owner of schain
     */
    function setBigTransferDelay(
        string calldata schainName,
        uint256 delayInSeconds
    )
        external
        override
        onlySchainOwner(schainName)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        // need to restrict big delays to avoid overflow
        require(delayInSeconds < 1e8, "Delay is too big"); // no more then ~ 3 years
        transferDelay[schainHash] = delayInSeconds;   
    }

    function setArbitrageDuration(
        string calldata schainName,
        uint256 delayInSeconds
    )
        external
        onlySchainOwner(schainName)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        // need to restrict big delays to avoid overflow
        require(delayInSeconds < 1e8, "Delay is too big"); // no more then ~ 3 years
        arbitrageDuration[schainHash] = delayInSeconds;   
    }

    /**
     * @dev Transfers tokens that was locked for delay during exit process.
     * Must be called by a receiver.
     */
    function retrieve() external {
        retrieve(msg.sender);
    }

    function retrieve(address receiver) public {
        uint256 transfersAmount = MathUpgradeable.min(
            delayedTransfersByReceiver[receiver].length(),
            _QUEUE_PROCESSING_LIMIT
        );

        uint256 currentIndex = 0;
        for (uint256 i = 0; i < transfersAmount; ++i) {
            uint256 transferId = uint256(delayedTransfersByReceiver[receiver].at(currentIndex));
            DelayedTransfer memory transfer = delayedTransfers[transferId];

            if (transfer.status == DelayedTransferStatus.DELAYED) {
                if (block.timestamp < transfer.untilTimestamp) {
                    break;
                } else {
                    _transfer(transfer.token, transfer.receiver, transfer.amount);
                    if (currentIndex > 0) {
                        delayedTransfers[transferId].status = DelayedTransferStatus.COMPLETED;
                        ++currentIndex;
                    } else {
                        delete delayedTransfers[transferId];
                        delayedTransfersByReceiver[receiver].popFront();
                    }                    
                }
            } else if (transfer.status == DelayedTransferStatus.ARBITRAGE) {
                if (block.timestamp < transfer.untilTimestamp) {
                    continue;
                } else {
                    _transfer(transfer.token, transfer.receiver, transfer.amount);
                    if (currentIndex > 0) {
                        delayedTransfers[transferId].status = DelayedTransferStatus.COMPLETED;
                        ++currentIndex;
                    } else {
                        delete delayedTransfers[transferId];
                        delayedTransfersByReceiver[receiver].popFront();
                    }
                }
            } else if (transfer.status == DelayedTransferStatus.COMPLETED) {
                if (currentIndex > 0) {
                    ++currentIndex;
                } else {
                    delete delayedTransfers[transferId];
                    delayedTransfersByReceiver[receiver].popFront();
                }
            } else {
                revert("Unknown transfer status");
            }
        }
    }

    function escalate(uint256 transferId) external {
        bytes32 schainHash = delayedTransfers[transferId].schainHash;
        require(
            hasRole(ARBITER_ROLE, msg.sender) || isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to request escalation"
        );
        require(delayedTransfers[transferId].status == DelayedTransferStatus.DELAYED, "The transfer has to be delayed");
        delayedTransfers[transferId].status = DelayedTransferStatus.ARBITRAGE;
        delayedTransfers[transferId].untilTimestamp = MathUpgradeable.max(
            delayedTransfers[transferId].untilTimestamp,
            block.timestamp + arbitrageDuration[schainHash]
        );
    }

    function validate(uint transferId) external onlySchainOwnerByHash(delayedTransfers[transferId].schainHash) {
        DelayedTransfer storage transfer = delayedTransfers[transferId];
        require(transfer.status == DelayedTransferStatus.ARBITRAGE, "Arbitrage has to be active");
        transfer.status = DelayedTransferStatus.COMPLETED;
        delete transfer.untilTimestamp;
        _transfer(transfer.token, transfer.receiver, transfer.amount);
    }

    function reject(uint transferId) external onlySchainOwnerByHash(delayedTransfers[transferId].schainHash) {
        DelayedTransfer storage transfer = delayedTransfers[transferId];
        require(transfer.status == DelayedTransferStatus.ARBITRAGE, "Arbitrage has to be active");
        transfer.status = DelayedTransferStatus.COMPLETED;
        delete transfer.untilTimestamp;
        // msg.sender is schain owner
        _transfer(transfer.token, msg.sender, transfer.amount);
    }

    /**
     * @dev Returns receiver of message.
     *
     * Requirements:
     *
     * - Sender contract should be defined and schain name cannot be `Mainnet`.
     */
    function gasPayer(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        view
        override
        checkReceiverChain(schainHash, sender)
        returns (address)
    {
        Messages.TransferErc20Message memory message = Messages.decodeTransferErc20Message(data);
        return message.receiver;
    }

    /**
     * @dev Should return true if token was added by Schain owner or 
     * added automatically after sending to schain if whitelist was turned off.
     */
    function getSchainToERC20(
        string calldata schainName,
        address erc20OnMainnet
    )
        external
        view
        override
        returns (bool)
    {
        return _schainToERC20[keccak256(abi.encodePacked(schainName))].contains(erc20OnMainnet);
    }

    /**
     * @dev Should return length of a set of all mapped tokens which were added by Schain owner 
     * or added automatically after sending to schain if whitelist was turned off.
     */
    function getSchainToAllERC20Length(string calldata schainName) external view override returns (uint256) {
        return _schainToERC20[keccak256(abi.encodePacked(schainName))].length();
    }

    /**
     * @dev Should return an array of range of tokens were added by Schain owner 
     * or added automatically after sending to schain if whitelist was turned off.
     */
    function getSchainToAllERC20(
        string calldata schainName,
        uint256 from,
        uint256 to
    )
        external
        view
        override
        returns (address[] memory tokensInRange)
    {
        require(
            from < to && to - from <= 10 && to <= _schainToERC20[keccak256(abi.encodePacked(schainName))].length(),
            "Range is incorrect"
        );
        tokensInRange = new address[](to - from);
        for (uint256 i = from; i < to; i++) {
            tokensInRange[i - from] = _schainToERC20[keccak256(abi.encodePacked(schainName))].at(i);
        }
    }

    function getDelayedAmount(address receiver, address token) external view returns (uint256 value) {
        uint256 delayedTransfersAmount = delayedTransfersByReceiver[receiver].length();
        for (uint256 i = 0; i < delayedTransfersAmount; ++i) {
            DelayedTransfer storage transfer = delayedTransfers[uint256(delayedTransfersByReceiver[msg.sender].at(i))];
            DelayedTransferStatus status = transfer.status;
            if (transfer.token == token) {
                if (status == DelayedTransferStatus.DELAYED || status == DelayedTransferStatus.ARBITRAGE) {
                    value += transfer.amount;
                }
            }
        }
    }

    function getNextUnlockTimestamp(address receiver, address token) external view returns (uint256 unlockTimestamp) {
        uint256 delayedTransfersAmount = delayedTransfersByReceiver[receiver].length();
        unlockTimestamp = type(uint256).max;
        for (uint256 i = 0; i < delayedTransfersAmount; ++i) {
            DelayedTransfer storage transfer = delayedTransfers[uint256(delayedTransfersByReceiver[msg.sender].at(i))];
            DelayedTransferStatus status = transfer.status;
            if (transfer.token == token) {
                if (status == DelayedTransferStatus.DELAYED) {
                    unlockTimestamp = MathUpgradeable.min(unlockTimestamp, transfer.untilTimestamp);
                    break;
                } else if (status == DelayedTransferStatus.ARBITRAGE) {
                    unlockTimestamp = MathUpgradeable.min(unlockTimestamp, transfer.untilTimestamp);
                }
            }
        }
    }

    /**
     * @dev Creates a new DepositBoxERC20 contract.
     */
    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,
        ILinker linkerValue,
        IMessageProxyForMainnet messageProxyValue
    )
        public
        override(DepositBox, IDepositBox)
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManagerValue, linkerValue, messageProxyValue);
    }

    /**
     * @dev Saves amount of tokens that was transferred to schain.
     */
    function _saveTransferredAmount(bytes32 schainHash, address erc20Token, uint256 amount) private {
        transferredAmount[schainHash][erc20Token] += amount;
    }

    /**
     * @dev Removes amount of tokens that was transferred from schain.
     */
    function _removeTransferredAmount(bytes32 schainHash, address erc20Token, uint256 amount) private {
        transferredAmount[schainHash][erc20Token] -= amount;
    }

    /**
     * @dev Allows DepositBoxERC20 to receive ERC20 tokens.
     * 
     * Emits an {ERC20TokenReady} event.
     * 
     * Requirements:
     * 
     * - Amount must be less than or equal to the total supply of the ERC20 contract.
     * - Whitelist should be turned off for auto adding tokens to DepositBoxERC20.
     */
    function _receiveERC20(
        string calldata schainName,
        address erc20OnMainnet,
        address to,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        ERC20Upgradeable erc20 = ERC20Upgradeable(erc20OnMainnet);
        uint256 totalSupply = erc20.totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = _schainToERC20[schainHash].contains(erc20OnMainnet);
        if (!isERC20AddedToSchain) {
            require(!isWhitelisted(schainName), "Whitelist is enabled");
            _addERC20ForSchain(schainName, erc20OnMainnet);
            data = Messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainnet,
                to,
                amount,
                _getErc20TotalSupply(erc20),
                _getErc20TokenInfo(erc20)
            );
        } else {
            data = Messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnMainnet,
                to,
                amount,
                _getErc20TotalSupply(erc20)
            );
        }
        emit ERC20TokenReady(erc20OnMainnet, amount);
    }

    /**
     * @dev Adds an ERC20 token to DepositBoxERC20.
     * 
     * Emits an {ERC20TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Given address should be contract.
     */
    function _addERC20ForSchain(string calldata schainName, address erc20OnMainnet) private {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        require(!_schainToERC20[schainHash].contains(erc20OnMainnet), "ERC20 Token was already added");
        _schainToERC20[schainHash].add(erc20OnMainnet);
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
    }


    function _addToDelayedQueue(
        address receiver,
        uint256 id,
        uint256 until
    )
        private
    {
        _addToDelayedQueueWithPriority(delayedTransfersByReceiver[receiver], id, until, _QUEUE_PROCESSING_LIMIT);
    }

    function _addToDelayedQueueWithPriority(
        DoubleEndedQueueUpgradeable.Bytes32Deque storage queue, 
        uint256 id, 
        uint256 until, 
        uint256 depthLimit
    )
        private
    {
        if (depthLimit == 0 || queue.empty()) {
            queue.pushBack(bytes32(id));
        } else {
            if (delayedTransfers[uint256(queue.back())].untilTimestamp <= until) {
                queue.pushBack(bytes32(id));
            } else {
                bytes32 lowPriorityValue = queue.popBack();
                _addToDelayedQueueWithPriority(queue, id, until, depthLimit - 1);
                queue.pushBack(lowPriorityValue);
            }
        }
    }

    function _transfer(address token, address receiver, uint256 amount) private {
        if (token == _USDT_ADDRESS) {
            // solhint-disable-next-line no-empty-blocks
            try IERC20TransferVoid(token).transfer(receiver, amount) {} catch {
                revert("Transfer was failed");
            }
        } else {
            require(
                ERC20Upgradeable(token).transfer(receiver, amount),
                "Transfer was failed"
            );
        }
    }

    /**
     * @dev Returns total supply of ERC20 token.
     */
    function _getErc20TotalSupply(ERC20Upgradeable erc20Token) private view returns (uint256) {
        return erc20Token.totalSupply();
    }

    /**
     * @dev Returns info about ERC20 token such as token name, decimals, symbol.
     */
    function _getErc20TokenInfo(ERC20Upgradeable erc20Token) private view returns (Messages.Erc20TokenInfo memory) {
        return Messages.Erc20TokenInfo({
            name: erc20Token.name(),
            decimals: erc20Token.decimals(),
            symbol: erc20Token.symbol()
        });
    }
}
