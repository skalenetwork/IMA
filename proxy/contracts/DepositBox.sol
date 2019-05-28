pragma solidity ^0.5.0;

import "./Ownable.sol";

interface Proxy {
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
    function approveTransfer(address to, uint amount) external;
}

// This contract runs on the main net and accepts deposits

contract DepositBox is Ownable {

    //address public skaleManagerAddress;

    enum TransactionOperation {
        transferETH, 
        transferERC20, 
        transferERC721, 
        rawTransferERC20, 
        rawTransferERC721
    }

    address public proxyAddress;
    address payable escrowAndDataAddress;

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000; // 0;
    uint public constant AVERAGE_TX_PRICE = 1000000000;

    //mapping(address => mapping(address => uint)) public allowed;

    event MoneyReceivedMessage(
        address sender, 
        string fromSchainID, 
        address to, 
        uint amount, 
        bytes data
    );

    event Error(
        address sender, 
        string fromSchainID, 
        address to, 
        uint amount, 
        bytes data, 
        string message
    );

    /// Create a new deposit box
    constructor(address newProxyAddress, address payable newEscrowAndDataAddress) public {
        proxyAddress = newProxyAddress;
        escrowAndDataAddress = newEscrowAndDataAddress;
    }

    function() external payable {
        revert();
    }

    function deposit(string memory schainID, address to) public payable {
        bytes memory empty;
        deposit(schainID, to, empty);
    }

    function deposit(
        string memory schainID, 
        address to, 
        bytes memory data
    ) 
        public 
        payable 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = LockAndData(escrowAndDataAddress).tokenManagerAddresses(schainHash);
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddress != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE); //average tx.gasprice
        data = abi.encodePacked(bytes1(uint8(1)), data);
        Proxy(proxyAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddress, 
            msg.value, 
            to, 
            data
        );
        escrowAndDataAddress.transfer(msg.value);
    }

    function postMessage(
        address sender, 
        string memory fromSchainID, 
        address payable to, 
        uint amount, 
        bytes memory data
    ) 
        public 
    {
        //require(msg.sender == proxyAddress);
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        if (schainHash == keccak256(abi.encodePacked("Mainnet") || sender != LockAndData(escrowAndDataAddress).tokenManagerAddresses(schainHash)) {
            emit Error(
                sender, 
                fromSchainID, 
                to, 
                amount, 
                data, 
                "Receiver chain is incorrect"
            );
        }
        
        if (!(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE <= address(escrowAndDataAddress).balance)) {
            emit Error(
                sender, 
                fromSchainID, 
                to, 
                amount, 
                data, 
                "Not enough money to finish this transaction"
            );
            return;
        }

        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }

        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            if (!LockAndData(escrowAndDataAddress).sendEth(owner, GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE)) {
                emit Error(
                    sender, 
                    fromSchainID, 
                    to, 
                    amount, 
                    data, 
                    "Could not send money to owner"
                );
            }
            LockAndData(escrowAndDataAddress).approveTransfer(to, amount - GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE);
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
        returns (uint, address payable, uint) 
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

    function fallbackRawDataParser(bytes memory data) 
        internal 
        pure 
        returns (address payable, uint) 
    {
        bytes32 to;
        bytes32 token;
        assembly {
            to := mload(add(data, 33))
            token := mload(add(data, 65))
        }
        return (address(bytes20(to)), uint(token));
    }
}