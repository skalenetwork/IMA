// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBox.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import "./interfaces/IMessageProxy.sol";

import "./PermissionsForMainnet.sol";
import "./ERC20ModuleForMainnet.sol";
import "./ERC721ModuleForMainnet.sol";
import "./Messages.sol";
import "@nomiclabs/buidler/console.sol";


// This contract runs on the main net and accepts deposits


contract DepositBox is PermissionsForMainnet {

    mapping (Messages.MessageType => uint256) public gasConsumptions;

    event MoneyReceivedMessage(
        address sender,
        string fromSchainID,
        address to,
        uint256 amount,
        bytes data
    );

    event Error(
        address to,
        uint256 amount,
        string message
    );

    modifier rightTransaction(string memory schainID) {
        require(
            keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")),
            "SKALE chain name is incorrect"
        );
        _;
    }

    modifier receivedEth() {
        _;
        if (msg.value > 0) {
            LockAndDataForMainnet(lockAndDataAddress_).receiveEth{value: msg.value}(msg.sender);
        }
    }

    receive() external payable {
        revert("Use deposit function");
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
        receivedEth
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = LockAndDataForMainnet(lockAndDataAddress_).tokenManagerAddresses(schainHash);
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(
            IERC20Upgradeable(contractOnMainnet).transferFrom(
                msg.sender,
                IContractManager(lockAndDataAddress_).getContract("LockAndDataERC20"),
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        bytes memory data = ERC20ModuleForMainnet(
            IContractManager(lockAndDataAddress_).getContract("ERC20Module")
        ).receiveERC20(
            schainID,
            contractOnMainnet,
            to,
            amount
        );
        IMessageProxy(IContractManager(lockAndDataAddress_).getContract("MessageProxy")).postOutgoingMessage(
            schainID,
            tokenManagerAddress,
            msg.value,
            address(0),
            data
        );
    }

    function depositERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
        payable
        rightTransaction(schainID)
        receivedEth
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = LockAndDataForMainnet(lockAndDataAddress_).tokenManagerAddresses(schainHash);
        require(tokenManagerAddress != address(0), "Unconnected chain");
        address lockAndDataERC721 = IContractManager(lockAndDataAddress_).getContract("LockAndDataERC721");
        IERC721Upgradeable(contractOnMainnet).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(
            IERC721Upgradeable(contractOnMainnet).ownerOf(tokenId) == lockAndDataERC721,
            "Did not transfer ERC721 token"
        );
        bytes memory data = ERC721ModuleForMainnet(
            IContractManager(lockAndDataAddress_).getContract("ERC721Module")
        ).receiveERC721(
            schainID,
            contractOnMainnet,
            to,
            tokenId
        );
        IMessageProxy(IContractManager(lockAndDataAddress_).getContract("MessageProxy")).postOutgoingMessage(
            schainID,
            tokenManagerAddress,
            msg.value,
            address(0),
            data
        );
    }

    function postMessage(
        string calldata fromSchainID,
        address sender,
        address to,
        uint256 amount,
        bytes calldata data
    )
        external
        allow("MessageProxy")
        returns (bool)
    {
        require(data.length != 0, "Invalid data");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == LockAndDataForMainnet(lockAndDataAddress_).tokenManagerAddresses(schainHash),
            "Receiver chain is incorrect"
        );
        require(
            amount <= address(lockAndDataAddress_).balance,
            "Not enough money to finish this transaction"
        );
        _executePerOperation(schainHash, to, amount, data);
        return true;
    }

    /// Create a new deposit box
    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
        gasConsumptions[Messages.MessageType.TRANSFER_ETH] = 390000;
        gasConsumptions[Messages.MessageType.TRANSFER_ERC20] = 430000;
        gasConsumptions[Messages.MessageType.TRANSFER_ERC721] = 550000;
    }

    function deposit(string memory schainID, address to)
        public
        payable
        rightTransaction(schainID)
        receivedEth
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = LockAndDataForMainnet(lockAndDataAddress_).tokenManagerAddresses(schainHash);
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(to != address(0), "Community Pool is not available");
        IMessageProxy(IContractManager(lockAndDataAddress_).getContract("MessageProxy")).postOutgoingMessage(
            schainID,
            tokenManagerAddress,
            msg.value,
            to,
            Messages.encodeTransferEthMessage()
        );
    }

    function _executePerOperation(
        bytes32 schainId,
        address to,
        uint256 amount,
        bytes calldata data    
    )
        private
    {
        Messages.MessageType operation = Messages.getMessageType(data);
        uint256 txFee = gasConsumptions[operation] * tx.gasprice;
        require(amount >= txFee, "Not enough funds to recover gas");
        if (operation == Messages.MessageType.TRANSFER_ETH) {
            if (amount > txFee) {
                LockAndDataForMainnet(lockAndDataAddress_).approveTransfer(
                    to,
                    amount - txFee
                );
            }
        } else if (operation == Messages.MessageType.TRANSFER_ERC20) {
            address erc20Module = IContractManager(lockAndDataAddress_).getContract(
                "ERC20Module"
            );
            require(ERC20ModuleForMainnet(erc20Module).sendERC20(data), "Sending of ERC20 was failed");
            address receiver = ERC20ModuleForMainnet(erc20Module).getReceiver(data);
            if (amount > txFee)
                LockAndDataForMainnet(lockAndDataAddress_).approveTransfer(
                    receiver,
                    amount - txFee
                );
        } else if (operation == Messages.MessageType.TRANSFER_ERC721) {
            address erc721Module = IContractManager(lockAndDataAddress_).getContract(
                "ERC721Module"
            );
            require(ERC721ModuleForMainnet(erc721Module).sendERC721(data), "Sending of ERC721 was failed");
            address receiver = ERC721ModuleForMainnet(erc721Module).getReceiver(data);
            if (amount > txFee)
                LockAndDataForMainnet(lockAndDataAddress_).approveTransfer(
                    receiver,
                    amount - txFee
                );
        } else {
            revert("MessageType is unknown");
        }
        LockAndDataForMainnet(lockAndDataAddress_).rechargeSchainWallet(schainId, txFee);
    }
}
