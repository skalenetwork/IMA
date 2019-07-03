/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE-IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE-IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE-IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity ^0.5.0;

import "./Permissions.sol";
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';

interface ProxyForSchain {
    function postOutgoingMessage(
        string calldata dstChainID,
        address dstContract,
        uint amount,
        address to,
        bytes calldata data
    )
        external;
}

interface LockAndData {
    function setContract(string calldata contractName, address newContract) external;
    function tokenManagerAddresses(bytes32 schainHash) external returns (address);
    function sendEth(address to, uint amount) external returns (bool);
    function receiveEth(address sender, uint amount) external returns (bool);
    function approveTransfer(address to, uint amount) external;
    function ethCosts(address to) external returns (uint);
    function addGasCosts(address to, uint amount) external;
    function reduceGasCosts(address to, uint amount) external returns (bool);
}

interface ERC20Module {
    function receiveERC20(address contractHere, address to, uint amount, bool isRaw) external returns (bytes memory);
    function sendERC20(address to, bytes calldata data) external returns (bool);
    function getReceiver(address to, bytes calldata data) external pure returns (address);
}

// This contract runs on schains and accepts messages from main net creates ETH clones.
// When the user exits, it burns them

contract TokenManager is Permissions {


    enum TransactionOperation {
        transferETH,
        transferERC20,
        transferERC721,
        rawTransferERC20,
        rawTransferERC721
    }

    // ID of this schain,
    string public chainID;

    address public proxyForSchainAddress;

    address public lockAndDataAddress;

    // The maximum amount of ETH clones this contract can create
    // It is 102000000 which is the current total ETH supply

    // TODO: TOKEN_RESERVE = 102000000 * (10 ** 18);

    //uint public TOKEN_RESERVE = 102000000 * (10 ** 18); //ether
    //uint public TOKEN_RESERVE = 10 * (10 ** 18); //ether

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000;
    uint public constant AVERAGE_TX_PRICE = 1000000000;

    // Owner of this schain. For mainnet
    //address public owner;

    event Error(
        address sender,
        string fromSchainID,
        address to,
        uint amount,
        bytes data,
        string message
    );

    modifier rightTransaction(string memory schainID) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address schainTokenManagerAddress = LockAndData(lockAndDataAddress).tokenManagerAddresses(schainHash);
        require(schainHash != keccak256(abi.encodePacked("Mainnet")), "This function is not for transfering to Mainnet");
        require(schainTokenManagerAddress != address(0), "Incorrect Token Manager address");
        _;
    }

    modifier receivedEth(uint amount) {
        require(amount > 0, "Null Amount");
        require(LockAndData(lockAndDataAddress).receiveEth(msg.sender, amount), "Could not receive ETH Clone");
        _;
    }


    /// Create a new token manager

    constructor(
        string memory newChainID,
        address newProxyAddress,
        address newLockAndDataAddress
    )
        Permissions(newLockAndDataAddress)
        public
    {
        chainID = newChainID;
        proxyForSchainAddress = newProxyAddress;
        lockAndDataAddress = newLockAndDataAddress;
    }

    function() external {
        revert("Not allowed");
    }

    // This is called by schain owner.
    // Exit to main net
    function exitToMain(address to, uint amount) public {
        bytes memory empty;
        exitToMain(to, amount, empty);
    }

    function exitToMain(address to, uint amount, bytes memory data) public receivedEth(amount) {
        bytes memory newData;
        newData = abi.encodePacked(bytes1(uint8(1)), data);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet",
            LockAndData(lockAndDataAddress).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amount,
            to,
            newData
        );
    }

    function transferToSchain(string memory schainID, address to, uint amount) public {
        bytes memory data;
        transferToSchain(schainID, to, amount, data);
    }

    function transferToSchain(
        string memory schainID,
        address to,
        uint amount,
        bytes memory data
    )
        public
        rightTransaction(schainID)
        receivedEth(amount)
    {
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID,
            LockAndData(lockAndDataAddress).tokenManagerAddresses(keccak256(abi.encodePacked(schainID))),
            amount,
            to,
            data
        );
    }

    function addEthCost(uint amount) public receivedEth(amount) {
        LockAndData(lockAndDataAddress).addGasCosts(msg.sender, amount);
    }

    function exitToMainERC20(address contractHere, address to, uint amount) public {
        address lockAndDataERC20 = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        address erc20Module = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("ERC20Module")));
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        require(LockAndData(lockAndDataAddress).reduceGasCosts(msg.sender, GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE), "Not enough gas sent");
        bytes memory data = ERC20Module(erc20Module).receiveERC20(contractHere, to, amount, false);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet",
            LockAndData(lockAndDataAddress).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE,
            address(0),
            data
        );
    }

    // Receive money from main net and Schain

    function postMessage(
        address sender,
        string memory fromSchainID,
        address to,
        uint amount,
        bytes memory data
    )
        public
    {
        require(msg.sender == proxyForSchainAddress, "Not a sender");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        if (schainHash == keccak256(abi.encodePacked(chainID)) || sender != LockAndData(lockAndDataAddress).tokenManagerAddresses(schainHash)) {
            emit Error(
                sender,
                fromSchainID,
                to,
                amount,
                data,
                "Receiver chain is incorrect"
            );
            return;
        }

        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }

        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(to != address(0), "Incorrect receiver");
            require(LockAndData(lockAndDataAddress).sendEth(to, amount), "Not Send");
            return;
        } else if (operation == TransactionOperation.transferERC20 || operation == TransactionOperation.rawTransferERC20) {
            address erc20Module = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("ERC20Module")));
            ERC20Module(erc20Module).sendERC20(to, data);
            address receiver = ERC20Module(erc20Module).getReceiver(to, data);
            require(LockAndData(lockAndDataAddress).sendEth(receiver, amount), "Not Send");
        }
    }

    /**
     * @dev Convert first byte of data to Operation
     * 0x01 - transfer eth
     * 0x03 - transfer ERC20 token
     * 0x05 - transfer ERC721 token
     * 0x13 - transfer ERC20 token - raw mode
     * 0x15 - transfer ERC721 token - raw mode
     * @param data - received data
     * @return operation
     */
    function fallbackOperationTypeConvert(bytes memory data)
        internal
        pure
        returns (TransactionOperation)
    {
        bytes1 operationType;
        assembly {
            operationType := mload(add(data, 0x20))
        }
        require(
            operationType == 0x01 ||
            operationType == 0x03 ||
            operationType == 0x05 ||
            operationType == 0x13 ||
            operationType == 0x15,
            "Operation type is not identified"
        );
        if (operationType == 0x01) {
            return TransactionOperation.transferETH;
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        } else if (operationType == 0x13) {
            return TransactionOperation.rawTransferERC20;
        } else if (operationType == 0x15) {
            return TransactionOperation.rawTransferERC721;
        }
    }

    function fallbackDataParser(bytes memory data)
        internal
        pure
        returns (uint, address, uint)
    {
        bytes32 contractIndex;
        bytes32 to;
        bytes32 token;
        assembly {
            contractIndex := mload(add(data, 33))
            to := mload(add(data, 65))
            token := mload(add(data, 97))
        }
        return (
            uint(contractIndex), address(bytes20(to)), uint(token)
        );
    }

    function fallbackContractIndexDataParser(bytes memory data)
        internal
        pure
        returns (uint)
    {
        bytes32 contractIndex;
        assembly {
            contractIndex := mload(add(data, 33))
        }
        return uint(contractIndex);
    }

    function fallbackRawDataParser(bytes memory data)
        internal
        pure
        returns (address, uint)
    {
        bytes32 to;
        bytes32 amount;
        assembly {
            to := mload(add(data, 33))
            amount := mload(add(data, 65))
        }
        return (address(bytes20(to)), uint(amount));
    }
}