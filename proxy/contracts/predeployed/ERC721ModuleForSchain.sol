pragma solidity ^0.5.3;

import "./PermissionsForSchain.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721Full.sol";

interface ITokenFactoryForERC721 {
    function createERC721(bytes calldata data)
        external
        returns (address payable);
}

interface ILockAndDataERC721S {
    function erc721Tokens(uint256 index) external returns (address);
    function erc721Mapper(address contractERC721) external returns (uint256);
    function addERC721Token(address contractERC721, uint256 contractPosition) external;
    function sendERC721(address contractHere, address to, uint256 tokenId) external returns (bool);
    function receiveERC721(address contractHere, uint256 tokenId) external returns (bool);
}


contract ERC721ModuleForSchain is PermissionsForSchain {

    event ERC721TokenCreated(uint256 indexed contractPosition, address tokenAddress);


    constructor(address newLockAndDataAddress) PermissionsForSchain(newLockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function receiveERC721(
        address contractHere,
        address to,
        uint256 tokenId,
        bool isRAW) external allow("TokenManager") returns (bytes memory data)
        {
        address lockAndDataERC721 = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        if (!isRAW) {
            uint256 contractPosition = ILockAndDataERC721S(lockAndDataERC721).erc721Mapper(contractHere);
            require(contractPosition > 0, "Not existing ERC-721 contract");
            require(ILockAndDataERC721S(lockAndDataERC721).receiveERC721(contractHere, tokenId), "Cound not receive ERC721 Token");
            data = encodeData(
                contractHere,
                contractPosition,
                to,
                tokenId);
            return data;
        } else {
            data = encodeRawData(to, tokenId);
            return data;
        }
    }

    function sendERC721(address to, bytes calldata data) external allow("TokenManager") returns (bool) {
        address lockAndDataERC721 = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        uint256 contractPosition;
        address contractAddress;
        address receiver;
        uint256 tokenId;
        if (to == address(0)) {
            (contractPosition, receiver, tokenId) = fallbackDataParser(data);
            contractAddress = ILockAndDataERC721S(lockAndDataERC721).erc721Tokens(contractPosition);
            if (contractAddress == address(0)) {
                address tokenFactoryAddress = IContractManagerForSchain(getLockAndDataAddress()).
                    permitted(keccak256(abi.encodePacked("TokenFactory")));
                contractAddress = ITokenFactoryForERC721(tokenFactoryAddress).createERC721(data);
                emit ERC721TokenCreated(contractPosition, contractAddress);
                ILockAndDataERC721S(lockAndDataERC721).addERC721Token(contractAddress, contractPosition);
            }
        } else {
            (receiver, tokenId) = fallbackRawDataParser(data);
            contractAddress = to;
        }
        return ILockAndDataERC721S(lockAndDataERC721).sendERC721(contractAddress, receiver, tokenId);
    }

    function getReceiver(address to, bytes calldata data) external pure returns (address receiver) {
        uint256 contractPosition;
        uint256 tokenId;
        if (to == address(0)) {
            (contractPosition, receiver, tokenId) = fallbackDataParser(data);
        } else {
            (receiver, tokenId) = fallbackRawDataParser(data);
        }
    }

    function encodeData(
        address contractHere,
        uint256 contractPosition,
        address to,
        uint256 tokenId) internal view returns (bytes memory data)
        {
        string memory name = IERC721Full(contractHere).name();
        string memory symbol = IERC721Full(contractHere).symbol();
        data = abi.encodePacked(
            bytes1(uint8(5)),
            bytes32(contractPosition),
            bytes32(bytes20(to)),
            bytes32(tokenId),
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol
        );
    }

    function encodeRawData(address to, uint256 tokenId) internal pure returns (bytes memory data) {
        data = abi.encodePacked(
            bytes1(uint8(21)),
            bytes32(bytes20(to)),
            bytes32(tokenId)
        );
    }

    function fallbackDataParser(bytes memory data)
        internal
        pure
        returns (uint256, address payable, uint256)
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
            uint256(contractIndex), address(bytes20(to)), uint256(token)
        );
    }

    function fallbackRawDataParser(bytes memory data)
        internal
        pure
        returns (address payable, uint256)
    {
        bytes32 to;
        bytes32 token;
        assembly {
            to := mload(add(data, 33))
            token := mload(add(data, 65))
        }
        return (address(bytes20(to)), uint256(token));
    }
}


