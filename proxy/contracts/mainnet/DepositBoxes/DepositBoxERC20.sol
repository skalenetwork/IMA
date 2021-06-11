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

import "../../thirdparty/openzeppelin/IERC20Metadata.sol";
import "../../Messages.sol";
import "../DepositBox.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxERC20 is DepositBox {

    mapping(bytes32 => mapping(address => uint256)) public transferredAmount;

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC20.
     */
    event ERC20TokenAdded(string schainName, address indexed contractOnMainnet);
    
    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(address indexed contractOnMainnet, uint256 amount);

    function depositERC20(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        rightTransaction(schainName, to)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            IERC20Metadata(contractOnMainnet).allowance(msg.sender, address(this)) >= amount,
            "DepositBox was not approved for ERC20 token"
        );
        bytes memory data = _receiveERC20(
            schainName,
            contractOnMainnet,
            to,
            amount
        );
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, contractOnMainnet, amount);
        require(
            IERC20Metadata(contractOnMainnet).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        onlyMessageProxy
        whenNotKilled(schainHash)
        returns (address)
    {
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == schainLinks[schainHash],
            "Receiver chain is incorrect"
        );
        Messages.TransferErc20Message memory message = Messages.decodeTransferErc20Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(IERC20Metadata(message.token).balanceOf(address(this)) >= message.amount, "Not enough money");
        if (!linker.interchainConnections(schainHash))
            _removeTransferredAmount(schainHash, message.token, message.amount);
        require(
            IERC20Metadata(message.token).transfer(message.receiver, message.amount),
            "Something went wrong with `transfer` in ERC20"
        );
        return message.receiver;
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to LockAndDataForMainnetERC20.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet)
        external
        onlySchainOwner(schainName)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainHash], "Whitelist is enabled");
        schainToERC[schainHash][erc20OnMainnet] = true;
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
    }

    function getFunds(string calldata schainName, address erc20OnMainnet, address receiver, uint amount)
        external
        onlySchainOwner(schainName)
        whenKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(transferredAmount[schainHash][erc20OnMainnet] >= amount, "Incorrect amount");
        _removeTransferredAmount(schainHash, erc20OnMainnet, amount);
        require(
            IERC20Metadata(erc20OnMainnet).transfer(receiver, amount),
            "Something went wrong with `transfer` in ERC20"
        );
    }

    /**
     * @dev Should return true if token in whitelist.
     */
    function getSchainToERC(string calldata schainName, address erc20OnMainnet) external view returns (bool) {
        return schainToERC[keccak256(abi.encodePacked(schainName))][erc20OnMainnet];
    }

    /// Create a new deposit box
    function initialize(
        IContractManager contractManagerOfSkaleManager,
        Linker linker,
        MessageProxyForMainnet messageProxy
    )
        public
        override
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManager, linker, messageProxy);
    }

    function _saveTransferredAmount(bytes32 schainHash, address erc20Token, uint256 amount) private {
        transferredAmount[schainHash][erc20Token] = transferredAmount[schainHash][erc20Token].add(amount);
    }

    function _removeTransferredAmount(bytes32 schainHash, address erc20Token, uint256 amount) private {
        transferredAmount[schainHash][erc20Token] = transferredAmount[schainHash][erc20Token].sub(amount);
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
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        uint256 totalSupply = IERC20Metadata(contractOnMainnet).totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = schainToERC[keccak256(abi.encodePacked(schainName))][contractOnMainnet];
        if (!isERC20AddedToSchain) {
            _addERC20ForSchain(schainName, contractOnMainnet);
            emit ERC20TokenAdded(schainName, contractOnMainnet);
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
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainHash], "Whitelist is enabled");
        schainToERC[schainHash][erc20OnMainnet] = true;
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
