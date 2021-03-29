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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./thirdparty/openzeppelin/IERC20Metadata.sol";

import "./IMAConnected.sol";
import "./Messages.sol";
import "./interfaces/IDepositBox.sol";


// This contract runs on the main net and accepts deposits


contract DepositBoxERC20 is IMAConnected, IDepositBox {

    // uint256 public gasConsumption;

    mapping(bytes32 => address) public tokenManagerERC20Addresses;

    // schainID => address of ERC20 on Mainnet
    mapping(bytes32 => mapping(address => bool)) public schainToERC20;
    mapping(bytes32 => bool) public withoutWhitelist;

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC20.
     */
    event ERC20TokenAdded(string schainID, address indexed contractOnMainnet);
    
    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(address indexed contractOnMainnet, uint256 amount);

    modifier rightTransaction(string memory schainID) {
        require(
            keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")),
            "SKALE chain name is incorrect"
        );
        _;
    }

    function depositERC20(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        payable
        rightTransaction(schainID)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = tokenManagerERC20Addresses[schainHash];
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(
            IERC20Metadata(contractOnMainnet).transferFrom(
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
        messageProxy.postOutgoingMessage(
            schainID,
            tokenManagerAddress,
            msg.value,
            address(0),
            data
        );
    }

    /**
     * @dev Adds a TokenManagerERC20 address to
     * DepositBoxERC20.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addTokenManager(string calldata schainID, address newTokenManagerERC20Address) external override {
        require(
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC20Addresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerERC20Address != address(0), "Incorrect Token Manager address");
        tokenManagerERC20Addresses[schainHash] = newTokenManagerERC20Address;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerERC20 on SKALE chain
     * from DepositBoxERC20.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeTokenManager(string calldata schainID) external override {
        require(
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC20Addresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerERC20Addresses[schainHash];
    }

    function postMessage(
        string calldata fromSchainID,
        address sender,
        address,
        uint256,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        returns (bool)
    {
        require(data.length != 0, "Invalid data");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == tokenManagerERC20Addresses[schainHash],
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        // TODO add gas reimbusement
        // uint256 txFee = gasConsumption * tx.gasprice;
        // require(amount >= txFee, "Not enough funds to recover gas");
        if (operation == Messages.MessageType.TRANSFER_ERC20) {
            require(_sendERC20(data), "Sending of ERC20 was failed");
        } else {
            revert("MessageType is unknown");
        }
        // TODO add gas reimbusement
        // imaLinker.rechargeSchainWallet(schainId, txFee);
        return true;
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to LockAndDataForMainnetERC20.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet) external {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(isSchainOwner(msg.sender, schainId) || msg.sender == getOwner(), "Sender is not a Schain owner");
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC20[schainId][erc20OnMainnet] = true;
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
    }

    /**
     * @dev Allows Schain owner turn on whitelist of tokens.
     */
    function enableWhitelist(string memory schainName) external {
        require(isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))), "Sender is not a Schain owner");
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = false;
    }

    /**
     * @dev Allows Schain owner turn off whitelist of tokens.
     */
    function disableWhitelist(string memory schainName) external {
        require(isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))), "Sender is not a Schain owner");
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = true;
    }

    /**
     * @dev Should return true if token in whitelist.
     */
    function getSchainToERC20(string calldata schainName, address erc20OnMainnet) external view returns (bool) {
        return schainToERC20[keccak256(abi.encodePacked(schainName))][erc20OnMainnet];
    }

    /**
     * @dev Checks whether depositBoxERC20 is connected to a SKALE chain TokenManagerERC20.
     */
    function hasTokenManager(string calldata schainID) external view override returns (bool) {
        return tokenManagerERC20Addresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /// Create a new deposit box
    function initialize(
        address newIMALinkerAddress,
        address newContractManagerOfSkaleManager,
        address newMessageProxyAddress
    )
        public
        override
        initializer
    {
        IMAConnected.initialize(newIMALinkerAddress, newContractManagerOfSkaleManager, newMessageProxyAddress);
        // gasConsumption = 500000;
    }

    /**
     * @dev Allows DepositBox to receive ERC20 tokens.
     * 
     * Emits an {ERC20TokenAdded} event on token mapping in LockAndDataForMainnetERC20.
     * Emits an {ERC20TokenReady} event.
     * 
     * Requirements:
     * 
     * - Amount must be less than or equal to the total supply of the ERC20 contract.
     */
    function _receiveERC20(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        uint256 totalSupply = IERC20Metadata(contractOnMainnet).totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = schainToERC20[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        if (!isERC20AddedToSchain) {
            _addERC20ForSchain(schainID, contractOnMainnet);
            emit ERC20TokenAdded(schainID, contractOnMainnet);
            data = Messages.encodeTransferErc20AndTokenInfoMessage(
                contractOnMainnet,
                to,
                amount,
                _getErc20TotalSupply(IERC20Metadata(contractOnMainnet)),
                _getErc20TokenInfo(IERC20Metadata(contractOnMainnet))
            );
        } else {
            data = Messages.encodeTransferErc20AndTotalSupplyMessage(
                contractOnMainnet,
                to,
                amount,
                _getErc20TotalSupply(IERC20Metadata(contractOnMainnet))
            );
        }
        emit ERC20TokenReady(contractOnMainnet, amount);
    }

    /**
     * @dev Allows DepositBox to send ERC20 tokens.
     */
    function _sendERC20(bytes calldata data) private returns (bool) {
        Messages.TransferErc20Message memory message = Messages.decodeTransferErc20Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(IERC20Metadata(message.token).balanceOf(address(this)) >= message.amount, "Not enough money");
        require(
            IERC20Metadata(message.token).transfer(message.receiver, message.amount),
            "Something went wrong with `transfer` in ERC20"
        );
        return true;
    }

    /**
     * @dev Allows ERC20Module to add an ERC20 token to LockAndDataForMainnetERC20.
     */
    function _addERC20ForSchain(string calldata schainName, address erc20OnMainnet) private {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC20[schainId][erc20OnMainnet] = true;
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
    }

    function _getErc20TotalSupply(IERC20Metadata erc20Token) private view returns (uint256) {
        return erc20Token.totalSupply();
    }

    function _getErc20TokenInfo(IERC20Metadata erc20Token) private view returns (Messages.Erc20TokenInfo memory) {
        return Messages.Erc20TokenInfo({
            name: erc20Token.name(),
            decimals: erc20Token.decimals(),
            symbol: erc20Token.symbol()
        });
    }
}
