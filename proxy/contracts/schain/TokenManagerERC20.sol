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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ITokenManager.sol";
import "../Messages.sol";
import "./connectors/LinkerConnectorSchain.sol";

import "./TokenFactory.sol";

interface ERC20MintAndBurn {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function balanceOf(address to) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

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
contract TokenManagerERC20 is LinkerConnectorSchain, ITokenManager {

    address public depositBoxERC20;

    address private _tokenFactory;

    mapping(bytes32 => address) public tokenManagerERC20Addresses;

    // address of ERC20 on Mainnet => address of ERC20 on Schain
    mapping(bytes32 => mapping(address => address)) public schainToERC20OnSchain;
    //     schainId => bool 
    mapping(bytes32 => bool) public automaticDeploy;
    // address of clone on schain => totalSupplyOnMainnet
    mapping(address => uint) public totalSupplyOnMainnet;

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
            schainHash != keccak256(abi.encodePacked("Mainnet")),
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
        address newMessageProxyAddress,
        address newIMALinker
    )
        public
        LinkerConnectorSchain(newChainID, newMessageProxyAddress, newIMALinker)
    {
        
    }

    /**
     * @dev Adds a DepositBoxERC20 address to
     * TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - DepositBoxERC20 must not already be added.
     * - DepositBoxERC20 address must be non-zero.
     */
    function addDepositBox(address newDepositBoxERC20Address) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        require(depositBoxERC20 == address(0), "DepositBoxERC20 is already set");
        require(newDepositBoxERC20Address != address(0), "Incorrect DepoositBoxEth address");
        depositBoxERC20 = newDepositBoxERC20Address;
    }

    /**
     * @dev Allows Owner to remove a DepositBoxERC20 on SKALE chain
     * from TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - DepositBoxERC20 must already be set.
     */
    function removeDepositBox() external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        require(depositBoxERC20 != address(0), "DepositBoxERC20 is not set");
        delete depositBoxERC20;
    }

    /**
     * @dev Adds a TokenManagerEth address to
     * DepositBoxERC20.
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
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC20Addresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerERC20Address != address(0), "Incorrect Token Manager address");
        tokenManagerERC20Addresses[schainHash] = newTokenManagerERC20Address;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerEth on SKALE chain
     * from DepositBoxERC20.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeTokenManager(string calldata schainID) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC20Addresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerERC20Addresses[schainHash];
    }

    /**
     * @dev Allows Schain owner turn on automatic deploy on schain.
     */
    function enableAutomaticDeploy(string calldata schainName) external {
        require(isSchainOwner(msg.sender), "Sender is not a Schain owner");
        automaticDeploy[keccak256(abi.encodePacked(schainName))] = true;
    }

    /**
     * @dev Allows Schain owner turn off automatic deploy on schain.
     */
    function disableAutomaticDeploy(string calldata schainName) external {
        require(isSchainOwner(msg.sender), "Sender is not a Schain owner");
        automaticDeploy[keccak256(abi.encodePacked(schainName))] = false;
    }

    function exitToMainERC20(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
    {
        address contractOnSchain = schainToERC20OnSchain[keccak256(abi.encodePacked("Mainnet"))][contractOnMainnet];
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
        // require(amountOfEth >= TX_FEE, "Not enough funds to exit");
        // uint amountOfEthToSend = amountOfEth >= TX_FEE ?
        //     amountOfEth :
        //     ILockAndDataTM(getLockAndDataAddress()).reduceCommunityPool(TX_FEE) ? TX_FEE : 0;
        // require(amountOfEthToSend != 0, "Community pool is empty");
        bytes memory data = _receiveERC20(
            "Mainnet",
            contractOnMainnet,
            to,
            amount
        );
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            depositBoxERC20,
            data
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
        address contractOnSchain = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
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
        bytes memory data = _receiveERC20(
            schainID,
            contractOnMainnet,
            to,
            amount
        );
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            tokenManagerERC20Addresses[keccak256(abi.encodePacked(schainID))],
            data
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
        require(msg.sender == getProxyForSchainAddress(), "Not a sender");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != keccak256(abi.encodePacked(getChainID())) && 
            (
                schainHash == keccak256(abi.encodePacked("Mainnet")) ?
                sender == depositBoxERC20 :
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
     * @dev Checks whether TokenManagerERC20 is connected to a {schainID} SKALE chain TokenManagerERC20.
     */
    function hasTokenManager(string calldata schainID) external view override returns (bool) {
        return tokenManagerERC20Addresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /**
     * @dev Checks whether TokenManagerERC20 is connected to a mainnet DepositBoxERC20.
     */
    function hasDepositBox() external view override returns (bool) {
        return depositBoxERC20 != address(0);
    }

    /**
     * @dev Returns TokenFactory address
     */
    function getTokenFactory() public view returns (address) {
        if (_tokenFactory == address(0)) {
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.TokenFactory"
            );
        }
        return _tokenFactory;
    }

    function _sendCreateERC20Request(
        Messages.Erc20TokenInfo memory erc20TokenInfo
    )
        internal
        returns (address newToken)
    {
        address tokenFactoryAddress = getTokenFactory();
        newToken = TokenFactory(tokenFactoryAddress).createERC20(
            erc20TokenInfo.name,
            erc20TokenInfo.symbol
        );
    }

    /**
     * @dev Allows TokenManager to receive ERC20 tokens.
     * 
     * Requirements:
     * 
     * - ERC20 token contract must exist in LockAndDataForSchainERC20.
     * - ERC20 token must be received by LockAndDataForSchainERC20.
     */
    function _receiveERC20(
        string memory schainID,
        address contractOnMainnet,
        address receiver,
        uint256 amount
    ) 
        private
        returns (bytes memory data)
    {
        address contractOnSchain = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        require(contractOnSchain != address(0), "ERC20 contract does not exist on SKALE chain.");
        require(ERC20MintAndBurn(contractOnSchain).balanceOf(address(this)) >= amount, "Amount not transferred");
        ERC20MintAndBurn(contractOnSchain).burn(amount);
        data = Messages.encodeTransferErc20Message(contractOnMainnet, receiver, amount);
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
            address contractOnSchainTmp = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][token];
            if (contractOnSchainTmp == address(0)) {
                contractOnSchainTmp = _sendCreateERC20Request(
                    Messages.decodeTransferErc20AndTokenInfoMessage(data).tokenInfo
                );
                require(contractOnSchainTmp.isContract(), "Given address is not a contract");
                require(automaticDeploy[keccak256(abi.encodePacked(schainID))], "Automatic deploy is disabled");
                schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][token] = contractOnSchainTmp;
                emit ERC20TokenAdded(schainID, token, contractOnSchainTmp);
                emit ERC20TokenCreated(schainID, token, contractOnSchainTmp);
            }
        }
        address contractOnSchain = schainToERC20OnSchain[keccak256(abi.encodePacked(schainID))][token];
        if (totalSupply != totalSupplyOnMainnet[contractOnSchain])
        {
            totalSupplyOnMainnet[contractOnSchain] = totalSupply;
        }
        emit ERC20TokenReceived(token, contractOnSchain, amount);
        require(
            ERC20MintAndBurn(contractOnSchain).totalSupply() + amount <= totalSupplyOnMainnet[contractOnSchain],
            "Total supply exceeded"
        );
        ERC20MintAndBurn(contractOnSchain).mint(receiver, amount);
        return true;
    }
}