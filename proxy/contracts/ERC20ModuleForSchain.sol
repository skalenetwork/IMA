pragma solidity ^0.5.0;

import "./Permissions.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

interface TokenFactoryForSchain {
    function createERC20(bytes calldata data)
        external
        returns (address payable);
}

interface LockAndDataERC20 {
    function ERC20Tokens(uint index) external returns (address);
    function ERC20Mapper(address contractERC20) external returns (uint);
    function addERC20Token(address contractERC20, uint contractPosition) external;
    function sendERC20(address contractHere, address to, uint amount) external returns (bool);
}

contract ERC20ModuleForSchain is Permissions {

    event ERC20TokenCreated(address contractAddress);

    constructor(address payable newLockAndDataAddress) Permissions(newLockAndDataAddress) public {

    }

    function receiveERC20(address contractHere, address to, uint amount, bool isRAW) public returns (bytes memory data) {
        address lockAndDataERC20 = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        if (!isRAW) {
            uint contractPosition = LockAndDataERC20(lockAndDataERC20).ERC20Mapper(contractHere);
            require(contractPosition > 0, "Not existing ERC-20 contract");
            return encodeData(contractHere, contractPosition, to, amount);
        } else {
            return encodeRawData(to, amount);
        }
    }

    function encodeData(address contractHere, uint contractPosition, address to, uint amount) internal view returns (bytes memory data) {
        string memory name = ERC20Detailed(contractHere).name();
        uint8 decimals = ERC20Detailed(contractHere).decimals();
        string memory symbol = ERC20Detailed(contractHere).symbol();
        uint totalSupply = ERC20Detailed(contractHere).totalSupply();
        data = abi.encodePacked(
            bytes1(uint8(3)),
            bytes32(contractPosition),
            bytes32(bytes20(to)),
            bytes32(amount),
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol,
            decimals,
            totalSupply
        );
    }

    function encodeRawData(address to, uint amount) internal pure returns (bytes memory data) {
        data = abi.encodePacked(
            bytes1(uint8(19)),
            bytes32(bytes20(to)),
            bytes32(amount)
        );
    }

    function sendERC20(address to, bytes memory data) public returns (bool) {
        address lockAndDataERC20 = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        uint contractPosition;
        address contractAddress;
        address receiver;
        uint amount;
        if (to == address(0)) {
            (contractPosition, receiver, amount) = fallbackDataParser(data);
            contractAddress = LockAndDataERC20(lockAndDataERC20).ERC20Tokens(contractPosition);
            if (contractAddress == address(0)) {
                address tokenFactoryAddress = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("TokenFactory")));
                contractAddress = TokenFactoryForSchain(tokenFactoryAddress).createERC20(data);
                emit ERC20TokenCreated(contractAddress);
                LockAndDataERC20(lockAndDataERC20).addERC20Token(contractAddress, contractPosition);
            }
        } else {
            (receiver, amount) = fallbackRawDataParser(data);
            contractAddress = to;
        }
        return LockAndDataERC20(lockAndDataERC20).sendERC20(contractAddress, receiver, amount);
    }

    function getReceiver(address to, bytes memory data) public pure returns (address receiver) {
        uint contractPosition;
        uint amount;
        if (to == address(0)) {
            (contractPosition, receiver, amount) = fallbackDataParser(data);
        } else {
            (receiver, amount) = fallbackRawDataParser(data);
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