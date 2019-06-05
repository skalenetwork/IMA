pragma solidity ^0.5.0;

import "./Ownable.sol";
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
}

// This contract runs on schains and accepts messages from main net creates ETH clones.
// When the user exits, it burns them

contract TokenManager is Ownable {


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


    /// Create a new token manager

    constructor(
        string memory newChainID, 
        address newProxyAddress,
        address newLockAndDataAddress
    ) 
        public 
    {
        chainID = newChainID;
        proxyForSchainAddress = newProxyAddress;
        lockAndDataAddress = newLockAndDataAddress;
    }

    function() external {
        revert();
    }

    // This is called by schain owner.
    // Exit to main net
    function exitToMain(address to, uint amount) public {
        bytes memory empty;
        exitToMain(to, amount, empty);
    }

    function exitToMain(address to, uint amount, bytes memory data) public {
        require(amount > 0);
        require(LockAndData(lockAndDataAddress).receiveEth(msg.sender, amount));
        data = abi.encodePacked(bytes1(uint8(1)), data);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet", 
            LockAndData(lockAndDataAddress).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))), 
            amount, 
            to, 
            data
        );
    }

    function transferToSchain(
        string memory schainID, 
        address to, 
        uint amount,
        bytes memory data
    ) 
        public 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address schainTokenManagerAddress = LockAndData(lockAndDataAddress).tokenManagerAddresses(schainHash);
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(schainTokenManagerAddress != address(0));
        require(amount > 0);
        require(LockAndData(lockAndDataAddress).receiveEth(msg.sender, amount));
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID, 
            schainTokenManagerAddress, 
            amount, 
            to, 
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
            require(to != address(0));
            require(LockAndData(lockAndDataAddress).sendEth(to, amount), "Not Send");
            return;
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