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

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../interfaces/ITokenManager.sol";
import "../Messages.sol";
import "./connectors/LinkerConnectorSchain.sol";

import "./TokenFactory.sol";


/**
 * This contract runs on schains and accepts messages from main net creates ETH clones.
 * When the user exits, it burns them
 */

interface ERC721MintAndBurn {
    function mint(address to, uint256 tokenId) external returns (bool);
    function burn(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract TokenManagerERC721 is LinkerConnectorSchain, ITokenManager {

    address public depositBoxERC721;

    address private _tokenFactory;

    mapping(bytes32 => address) public tokenManagerERC721Addresses;
    // address of ERC721 on Mainnet => address of ERC721 on Schain
    mapping(bytes32 => mapping(address => address)) public schainToERC721OnSchain;
    //     schainId => bool 
    mapping(bytes32 => bool) public automaticDeploy;

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

    event ERC721TokenAdded(string chainID, address indexed erc721OnMainnet, address indexed erc721OnSchain);

    event ERC721TokenCreated(string chainID, address indexed erc721OnMainnet, address indexed erc721OnSchain);

    modifier rightTransaction(string memory schainID) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")),
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagerERC721Addresses[schainHash] != address(0), "Incorrect Token Manager address");
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
     * @dev Adds a DepositBoxERC721 address to
     * TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - DepositBoxERC721 must not already be added.
     * - DepositBoxERC721 address must be non-zero.
     */
    function addDepositBox(address newDepositBoxERC721Address) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        require(depositBoxERC721 == address(0), "DepositBoxERC721 is already set");
        require(newDepositBoxERC721Address != address(0), "Incorrect DepoositBoxEth address");
        depositBoxERC721 = newDepositBoxERC721Address;
    }

    /**
     * @dev Allows Owner to remove a DepositBoxERC721 on SKALE chain
     * from TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - DepositBoxERC721 must already be set.
     */
    function removeDepositBox() external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        require(depositBoxERC721 != address(0), "DepositBoxERC721 is not set");
        delete depositBoxERC721;
    }

    /**
     * @dev Adds a TokenManagerEth address to
     * DepositBoxERC721.
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
        require(tokenManagerERC721Addresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerERC20Address != address(0), "Incorrect Token Manager address");
        tokenManagerERC721Addresses[schainHash] = newTokenManagerERC20Address;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerEth on SKALE chain
     * from DepositBoxERC721.
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
        require(tokenManagerERC721Addresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerERC721Addresses[schainHash];
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

    function exitToMainERC721(
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
    {
        address contractOnSchain = schainToERC721OnSchain[keccak256(abi.encodePacked("Mainnet"))][contractOnMainnet];
        require(IERC721(contractOnSchain).getApproved(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721(contractOnSchain).transferFrom(msg.sender, address(this), tokenId);
        require(IERC721(contractOnSchain).ownerOf(tokenId) == address(this), "Did not transfer ERC721 token");
        // require(amountOfEth >= TX_FEE, "Not enough funds to exit");
        // uint amountOfEthToSend = amountOfEth >= TX_FEE ?
        //     amountOfEth :
        //     ILockAndDataTM(getLockAndDataAddress()).reduceCommunityPool(TX_FEE) ? TX_FEE : 0;
        // require(amountOfEthToSend != 0, "Community pool is empty");
        bytes memory data = _receiveERC721(
            "Mainnet",
            contractOnMainnet,
            to,
            tokenId
        );
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            depositBoxERC721,
            data
        );
    }

    function transferToSchainERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    ) 
        external
    {
        address contractOnSchain = schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        require(IERC721(contractOnSchain).getApproved(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721(contractOnSchain).transferFrom(msg.sender, address(this), tokenId);
        require(IERC721(contractOnSchain).ownerOf(tokenId) == address(this), "Did not transfer ERC721 token");
        bytes memory data = _receiveERC721(
            schainID,
            contractOnMainnet,
            to,
            tokenId
        );
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            tokenManagerERC721Addresses[keccak256(abi.encodePacked(schainID))],
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
                sender == depositBoxERC721 :
                sender == tokenManagerERC721Addresses[schainHash]
            ),
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        if (
            operation == Messages.MessageType.TRANSFER_ERC721_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC721
        ) {
            require(_sendERC721(fromSchainID, data), "Failed to send ERC721");
            // address receiver = ERC721ModuleForSchain(erc721Module).getReceiver(data);
            // require(LockAndDataForSchain(getLockAndDataAddress()).sendEth(receiver, amount), "Not Sent");
        } else {
            revert("MessageType is unknown");
        }
        return true;
    }

    /**
     * @dev Checks whether TokenManagerERC721 is connected to a {schainID} SKALE chain TokenManagerERC721.
     */
    function hasTokenManager(string calldata schainID) external view override returns (bool) {
        return tokenManagerERC721Addresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /**
     * @dev Checks whether TokenManagerERC721 is connected to a mainnet DepositBoxERC721.
     */
    function hasDepositBox() external view override returns (bool) {
        return depositBoxERC721 != address(0);
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

    function _sendCreateERC721Request(Messages.Erc721TokenInfo memory tokenInfo) internal returns (address) {
        address tokenFactoryAddress = getTokenFactory();
        return TokenFactory(tokenFactoryAddress).createERC721(tokenInfo.name, tokenInfo.symbol);
    }

    /**
     * @dev Allows TokenManager to receive ERC721 tokens.
     * 
     * Requirements:
     * 
     * - ERC721 token contract must exist in LockAndDataForSchainERC721.
     * - ERC721 token must be received by LockAndDataForSchainERC721.
     */
    function _receiveERC721(
        string calldata schainID,
        address contractOnMainnet,
        address receiver,
        uint256 tokenId
    ) 
        private
        returns (bytes memory data)
    {
        address contractOnSchain = schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        require(contractOnSchain != address(0), "ERC721 contract does not exist on SKALE chain");
        require(ERC721MintAndBurn(contractOnSchain).ownerOf(tokenId) == address(this), "Token not transferred");
        ERC721MintAndBurn(contractOnSchain).burn(tokenId);
        data = Messages.encodeTransferErc721Message(contractOnMainnet, receiver, tokenId);
    }

    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *  
     * Emits a {ERC721TokenCreated} event if to address = 0.
     */
    function _sendERC721(string calldata schainID, bytes calldata data) private returns (bool) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 tokenId;
        if (messageType == Messages.MessageType.TRANSFER_ERC721){
            Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
            receiver = message.receiver;
            token = message.token;
            tokenId = message.tokenId;
        } else {
            Messages.TransferErc721AndTokenInfoMessage memory message =
                Messages.decodeTransferErc721AndTokenInfoMessage(data);
            receiver = message.baseErc721transfer.receiver;
            token = message.baseErc721transfer.token;
            tokenId = message.baseErc721transfer.tokenId;
            address contractOnSchainTmp = schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][token];
            if (contractOnSchainTmp == address(0)) {
                contractOnSchainTmp = _sendCreateERC721Request(message.tokenInfo);
                require(contractOnSchainTmp.isContract(), "Given address is not a contract");
                require(automaticDeploy[keccak256(abi.encodePacked(schainID))], "Automatic deploy is disabled");
                schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][token] = contractOnSchainTmp;
                emit ERC721TokenAdded(schainID, token, contractOnSchainTmp);
                emit ERC721TokenCreated(schainID, token, contractOnSchainTmp);
            }
        }
        address contractOnSchain= schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][token];
        require(ERC721MintAndBurn(contractOnSchain).mint(receiver, tokenId), "Could not mint ERC721 Token");
        return true;
    }
}