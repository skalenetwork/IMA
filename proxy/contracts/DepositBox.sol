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

import "./PermissionsForMainnet.sol";
import "./interfaces/IMessageProxy.sol";
import "./interfaces/IERC20ModuleForMainnet.sol";
import "./interfaces/IERC721ModuleForMainnet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";

interface ILockAndDataDB {
    function tokenManagerAddresses(bytes32 schainHash) external returns (address);
    function approveTransfer(address to, uint256 amount) external;
    function sendEth(address to, uint256 amount) external;
    function receiveEth(address from) external payable;
    function rechargeSchainWallet(bytes32 schainId, uint256 amount) external;
}

// This contract runs on the main net and accepts deposits


contract DepositBox is PermissionsForMainnet {

    enum TransactionOperation {
        transferETH,
        transferERC20,
        transferERC721
    }

    mapping (TransactionOperation => uint256) public gasConsumptions;

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
            ILockAndDataDB(lockAndDataAddress_).receiveEth.value(msg.value)(msg.sender);
        }
    }

    fallback() external payable {
        revert("Not allowed. in DepositBox");
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
        address tokenManagerAddress = ILockAndDataDB(lockAndDataAddress_).tokenManagerAddresses(schainHash);
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(
            IERC20(contractOnMainnet).transferFrom(
                msg.sender,
                IContractManager(lockAndDataAddress_).getContract("LockAndDataERC20"),
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        bytes memory data = IERC20ModuleForMainnet(
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
        address tokenManagerAddress = ILockAndDataDB(lockAndDataAddress_).tokenManagerAddresses(schainHash);
        require(tokenManagerAddress != address(0), "Unconnected chain");
        address lockAndDataERC721 = IContractManager(lockAndDataAddress_).getContract("LockAndDataERC721");
        IERC721(contractOnMainnet).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721(contractOnMainnet).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        bytes memory data =IERC721ModuleForMainnet(
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
            sender == ILockAndDataDB(lockAndDataAddress_).tokenManagerAddresses(schainHash),
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
        gasConsumptions[TransactionOperation.transferETH] = 390000;
        gasConsumptions[TransactionOperation.transferERC20] = 430000;
        gasConsumptions[TransactionOperation.transferERC721] = 550000;
    }

    function deposit(string memory schainID, address to)
        public
        payable
        rightTransaction(schainID)
        receivedEth
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = ILockAndDataDB(lockAndDataAddress_).tokenManagerAddresses(schainHash);
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(to != address(0), "Community Pool is not available");
        IMessageProxy(IContractManager(lockAndDataAddress_).getContract("MessageProxy")).postOutgoingMessage(
            schainID,
            tokenManagerAddress,
            msg.value,
            to,
            abi.encodePacked(bytes1(uint8(1)))
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
        TransactionOperation operation = _fallbackOperationTypeConvert(data);
        uint256 txFee = gasConsumptions[operation] * tx.gasprice;
        require(amount >= txFee, "Not enough funds to recover gas");
        if (operation == TransactionOperation.transferETH) {
            if (amount > txFee)
                ILockAndDataDB(lockAndDataAddress_).approveTransfer(
                    to,
                    amount - txFee
                );
        } else if (operation == TransactionOperation.transferERC20) {
            address erc20Module = IContractManager(lockAndDataAddress_).getContract(
                "ERC20Module"
            );
            require(IERC20ModuleForMainnet(erc20Module).sendERC20(data), "Sending of ERC20 was failed");
            address receiver = IERC20ModuleForMainnet(erc20Module).getReceiver(data);
            if (amount > txFee)
                ILockAndDataDB(lockAndDataAddress_).approveTransfer(
                    receiver,
                    amount - txFee
                );
        } else if (operation == TransactionOperation.transferERC721) {
            address erc721Module = IContractManager(lockAndDataAddress_).getContract(
                "ERC721Module"
            );
            require(IERC721ModuleForMainnet(erc721Module).sendERC721(data), "Sending of ERC721 was failed");
            address receiver = IERC721ModuleForMainnet(erc721Module).getReceiver(data);
            if (amount > txFee)
                ILockAndDataDB(lockAndDataAddress_).approveTransfer(
                    receiver,
                    amount - txFee
                );
        }
        ILockAndDataDB(lockAndDataAddress_).rechargeSchainWallet(schainId, txFee);
    }

    /**
     * @dev Convert first byte of data to Operation
     * 0x01 - transfer eth
     * 0x03 - transfer ERC20 token
     * 0x05 - transfer ERC721 token
     * @param data - received data
     * @return operation
     */
    function _fallbackOperationTypeConvert(bytes memory data)
        private
        pure
        returns (TransactionOperation)
    {
        bytes1 operationType;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            operationType := mload(add(data, 0x20))
        }
        require(
            operationType == 0x01 ||
            operationType == 0x03 ||
            operationType == 0x05,
            "Operation type is not identified"
        );
        if (operationType == 0x01) {
            return TransactionOperation.transferETH;
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        } 
    }
}