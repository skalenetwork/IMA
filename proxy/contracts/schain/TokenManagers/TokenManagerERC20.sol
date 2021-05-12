// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@nomiclabs/buidler/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../Messages.sol";
import "../TokenFactory.sol";
import "../TokenManager.sol";


/**
 * This contract runs on schains and accepts messages from main net creates ETH clones.
 * When the user exits, it burns them
 */

/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract TokenManagerERC20 is TokenManager {

    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_ID = keccak256(abi.encodePacked(MAINNET_NAME));

    TokenFactory private _tokenFactory;

    mapping(bytes32 => address) public tokenManagerERC20Addresses;

    // schain id => address of ERC20 on Mainnet => address of ERC20 on Schain
    mapping(bytes32 => mapping(address => ERC20OnChain)) public schainToERC20OnSchain;
    
    // address of clone on schain => totalSupplyOnMainnet
    mapping(IERC20 => uint) public totalSupplyOnMainnet;

    /**
     * TX_FEE - equals "Eth exit" operation gas consumption (300 000 gas) multiplied by
     * max gas price of "Eth exit" (200 Gwei) = 60 000 000 Gwei = 0.06 Eth
     *
     * !!! IMPORTANT !!!
     * It is a max estimation, of "Eth exit" operation.
     * If it would take less eth - it would be returned to the mainnet DepositBox.
     * And you could take it back or send back to SKALE-chain.
     * !!! IMPORTANT !!!
     */
    uint256 public constant TX_FEE = 60000000000000000;

    event ERC20TokenAdded(string chainID, address indexed erc20OnMainnet, address indexed erc20OnSchain);

    event ERC20TokenCreated(string chainID, address indexed erc20OnMainnet, address indexed erc20OnSchain);

    event ERC20TokenReceived(address indexed erc20OnMainnet, address indexed erc20OnSchain, uint256 amount);

    modifier rightTransaction(string memory schainID) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(
            schainHash != MAINNET_ID,
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagerERC20Addresses[schainHash] != address(0), "Incorrect Token Manager address");
        _;
    }

    // modifier receivedEth(uint256 amount) {
    // if (amount > 0) {
    //     require(LockAndDataForSchain(getLockAndDataAddress())
    //         .receiveEth(msg.sender, amount), "Could not receive ETH Clone");
    // }
    //     _;
    // }

    /// Create a new token manager

    constructor(
        string memory newChainID,
        MessageProxyForSchain newMessageProxyAddress,
        TokenManagerLinker newIMALinker,
        address newDepositBox,
        TokenFactory newTokenFactory
    )
        public
        TokenManager(newChainID, newMessageProxyAddress, newIMALinker, newDepositBox, newTokenFactory)
        // solhint-disable-next-line no-empty-blocks
    { }

    /**
     * @dev Adds a depositBox address to
     * TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - depositBox must not already be added.
     * - depositBox address must be non-zero.
     */
    function addDepositBox(address newdepositBoxAddress) external override {
        require(
            msg.sender == address(tokenManagerLinker) ||
            _isSchainOwner(msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        require(depositBox == address(0), "depositBox is already set");
        require(newdepositBoxAddress != address(0), "Incorrect DepositBoxEth address");
        depositBox = newdepositBoxAddress;
    }

    /**
     * @dev Allows Owner to remove a depositBox on SKALE chain
     * from TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - depositBox must already be set.
     */
    function removeDepositBox() external override {
        require(
            msg.sender == address(tokenManagerLinker) ||
            _isSchainOwner(msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        require(depositBox != address(0), "depositBox is not set");
        delete depositBox;
    }

    /**
     * @dev Adds a TokenManagerEth address to
     * depositBox.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addTokenManager(string calldata schainID, address newTokenManagerERC20Address) external override {
        require(
            msg.sender == address(tokenManagerLinker) ||
            _isSchainOwner(msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC20Addresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerERC20Address != address(0), "Incorrect Token Manager address");
        tokenManagerERC20Addresses[schainHash] = newTokenManagerERC20Address;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerEth on SKALE chain
     * from depositBox.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeTokenManager(string calldata schainID) external override {
        require(
            msg.sender == address(tokenManagerLinker) ||
            _isSchainOwner(msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC20Addresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerERC20Addresses[schainHash];
    }

    function exitToMainERC20(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
    {
        ERC20Burnable contractOnSchain = schainToERC20OnSchain[schainId][contractOnMainnet];
        
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.balanceOf(address(this)) >= amount, "Insufficient funds");
        require(
            IERC20(contractOnSchain).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Transfer is not allowed by token holder"
        );
        require(
            IERC20(contractOnSchain).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        
        contractOnSchain.burn(amount);
        
        messageProxy.postOutgoingMessage(
            MAINNET_NAME,
            depositBox,
            Messages.encodeTransferErc20Message(contractOnMainnet, to, amount)
        );
    }

    function transferToSchainERC20(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        // receivedEth(amountOfEth)
    {
        ERC20Burnable contractOnSchain = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.balanceOf(address(this)) >= amount, "Insufficient funds");
        require(
            IERC20(contractOnSchain).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            IERC20(contractOnSchain).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "Could not transfer ERC20 Token"
        );

        contractOnSchain.burn(amount);

        messageProxy.postOutgoingMessage(
            schainID,
            tokenManagerERC20Addresses[keccak256(abi.encodePacked(schainID))],
            Messages.encodeTransferErc20Message(contractOnMainnet, to, amount)
        );
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     * 
     * Emits an {Error} event upon failure.
     *
     * Requirements:
     * 
     * - MessageProxy must be the sender.
     * - `fromSchainID` must exist in TokenManager addresses.
     */
    function postMessage(
        string calldata fromSchainID,
        address sender,
        bytes calldata data
    )
        external
        override
        returns (bool)
    {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != schainId && 
                (
                    schainHash == MAINNET_ID ?
                    sender == depositBox :
                    sender == tokenManagerERC20Addresses[schainHash]
                ),
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        if (
            operation == Messages.MessageType.TRANSFER_ERC20_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY
        ) {
            require(_sendERC20(fromSchainID, data), "Failed to send ERC20");
            // address receiver = ERC20ModuleForSchain(erc20Module).getReceiver(data);
            // require(LockAndDataForSchain(getLockAndDataAddress()).sendEth(receiver, amount), "Not Sent");
        } else {
            revert("MessageType is unknown");
        }
        return true;
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to LockAndDataForSchainERC20.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet, ERC20OnChain erc20OnSchain) external {
        require(_isSchainOwner(msg.sender), "Sender is not a Schain owner");
        require(address(erc20OnSchain).isContract(), "Given address is not a contract");
        require(erc20OnSchain.totalSupply() == 0, "TotalSupply is not zero");
        // require(!automaticDeploy[keccak256(abi.encodePacked(schainName))], "Custom deploy is enabled");
        schainToERC20OnSchain[keccak256(abi.encodePacked(schainName))][erc20OnMainnet] = erc20OnSchain;
        emit ERC20TokenAdded(schainName, erc20OnMainnet, address(erc20OnSchain));
    }

    /**
     * @dev Checks whether TokenManagerERC20 is connected to a {schainID} SKALE chain TokenManagerERC20.
     */
    function hasTokenManager(string calldata schainID) external view override returns (bool) {
        return tokenManagerERC20Addresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /**
     * @dev Checks whether TokenManagerERC20 is connected to a mainnet depositBox.
     */
    function hasDepositBox() external view override returns (bool) {
        return depositBox != address(0);
    }

    function getErc20OnSchain(string memory schainName, IERC20 tokenOnMainnetAddress) external view returns (IERC20) {
        return schainToERC20OnSchain[keccak256(abi.encodePacked(schainName))][address(tokenOnMainnetAddress)];
    }

    /**
     * @dev Allows TokenManager to send ERC20 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token does not exist.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function _sendERC20(string calldata schainID, bytes calldata data) private returns (bool) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 amount;
        uint256 totalSupply;
        if (messageType == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY) {
            Messages.TransferErc20AndTotalSupplyMessage memory message =
                Messages.decodeTransferErc20AndTotalSupplyMessage(data);
            receiver = message.baseErc20transfer.receiver;
            token = message.baseErc20transfer.token;
            amount = message.baseErc20transfer.amount;
            totalSupply = message.totalSupply;
        } else {
            Messages.TransferErc20AndTokenInfoMessage memory message =
                Messages.decodeTransferErc20AndTokenInfoMessage(data);
            receiver = message.baseErc20transfer.receiver;
            token = message.baseErc20transfer.token;
            amount = message.baseErc20transfer.amount;
            totalSupply = message.totalSupply;
            ERC20OnChain contractOnSchainTmp = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][token];
            if (address(contractOnSchainTmp) == address(0)) {
                contractOnSchainTmp = tokenFactory.createERC20(message.tokenInfo.name, message.tokenInfo.symbol);
                require(address(contractOnSchainTmp).isContract(), "Given address is not a contract");
                require(automaticDeploy, "Automatic deploy is disabled");
                schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][token] = contractOnSchainTmp;
                emit ERC20TokenAdded(schainID, token, address(contractOnSchainTmp));
                emit ERC20TokenCreated(schainID, token, address(contractOnSchainTmp));
            }
        }
        ERC20OnChain contractOnSchain = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][token];
        if (totalSupply != totalSupplyOnMainnet[contractOnSchain])
        {
            totalSupplyOnMainnet[contractOnSchain] = totalSupply;
        }
        emit ERC20TokenReceived(token, address(contractOnSchain), amount);
        require(
            contractOnSchain.totalSupply() + amount <= totalSupplyOnMainnet[contractOnSchain],
            "Total supply exceeded"
        );
        contractOnSchain.mint(receiver, amount);
        return true;
    }
}