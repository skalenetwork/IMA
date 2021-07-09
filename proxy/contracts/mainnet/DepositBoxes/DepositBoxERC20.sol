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

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../../Messages.sol";
import "../DepositBox.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxERC20 is DepositBox {
    using AddressUpgradeable for address;

        // schainHash => address of ERC on Mainnet
    mapping(bytes32 => mapping(address => bool)) public schainToERC20;
    mapping(bytes32 => mapping(address => uint256)) public transferredAmount;

    /**
     * @dev Emitted when token is mapped in DepositBoxERC20.
     */
    event ERC20TokenAdded(string schainName, address indexed contractOnMainnet);
    
    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(address indexed contractOnMainnet, uint256 amount);

    function depositERC20(
        string calldata schainName,
        address erc20OnMainnet,
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
            ERC20Upgradeable(erc20OnMainnet).allowance(msg.sender, address(this)) >= amount,
            "DepositBox was not approved for ERC20 token"
        );
        bytes memory data = _receiveERC20(
            schainName,
            erc20OnMainnet,
            to,
            amount
        );
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, erc20OnMainnet, amount);
        require(
            ERC20Upgradeable(erc20OnMainnet).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "Transfer was failed"
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
        override
        onlyMessageProxy
        whenNotKilled(schainHash)
        checkReceiverChain(schainHash, sender)
        returns (address)
    {
        Messages.TransferErc20Message memory message = Messages.decodeTransferErc20Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(ERC20Upgradeable(message.token).balanceOf(address(this)) >= message.amount, "Not enough money");
        if (!linker.interchainConnections(schainHash))
            _removeTransferredAmount(schainHash, message.token, message.amount);
        require(
            ERC20Upgradeable(message.token).transfer(message.receiver, message.amount),
            "Transfer was failed"
        );
        return message.receiver;
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to DepositBoxERC20.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet)
        external
        onlySchainOwner(schainName)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        _addERC20ForSchain(schainName, erc20OnMainnet);
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
            ERC20Upgradeable(erc20OnMainnet).transfer(receiver, amount),
            "Transfer was failed"
        );
    }

    /**
     * @dev Should return true if token in whitelist.
     */
    function getSchainToERC20(string calldata schainName, address erc20OnMainnet) external view returns (bool) {
        return schainToERC20[keccak256(abi.encodePacked(schainName))][erc20OnMainnet];
    }

    /// Create a new deposit box
    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,
        Linker linkerValue,
        MessageProxyForMainnet messageProxyValue
    )
        public
        override
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManagerValue, linkerValue, messageProxyValue);
    }

    function _saveTransferredAmount(bytes32 schainHash, address erc20Token, uint256 amount) private {
        transferredAmount[schainHash][erc20Token] += amount;
    }

    function _removeTransferredAmount(bytes32 schainHash, address erc20Token, uint256 amount) private {
        transferredAmount[schainHash][erc20Token] -= amount;
    }

    /**
     * @dev Allows DepositBox to receive ERC20 tokens.
     * 
     * Emits an {ERC20TokenAdded} event on token mapping in DepositBoxERC20.
     * Emits an {ERC20TokenReady} event.
     * 
     * Requirements:
     * 
     * - Amount must be less than or equal to the total supply of the ERC20 contract.
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
        bool isERC20AddedToSchain = schainToERC20[schainHash][erc20OnMainnet];
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

    function _addERC20ForSchain(string calldata schainName, address erc20OnMainnet) private {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        schainToERC20[schainHash][erc20OnMainnet] = true;
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
    }

    function _getErc20TotalSupply(ERC20Upgradeable erc20Token) private view returns (uint256) {
        return erc20Token.totalSupply();
    }

    function _getErc20TokenInfo(ERC20Upgradeable erc20Token) private view returns (Messages.Erc20TokenInfo memory) {
        return Messages.Erc20TokenInfo({
            name: erc20Token.name(),
            decimals: erc20Token.decimals(),
            symbol: erc20Token.symbol()
        });
    }
}
