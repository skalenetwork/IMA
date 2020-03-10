pragma solidity ^0.5.3;

import "./PermissionsForMainnet.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721Full.sol";

interface ILockAndDataERC721M {
    function erc721Tokens(uint256 index) external returns (address);
    function erc721Mapper(address contractERC721) external returns (uint256);
    function addERC721Token(address contractERC721) external returns (uint256);
    function sendERC721(address contractHere, address to, uint256 token) external returns (bool);
}


contract ERC721ModuleForMainnet is PermissionsForMainnet {

    event ERC721TokenAdded(address indexed tokenHere, uint256 contractPosition);

    constructor(address newLockAndDataAddress) PermissionsForMainnet(newLockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function receiveERC721(
        address contractHere,
        address to,
        uint256 tokenId,
        bool isRAW) external allow("DepositBox") returns (bytes memory data)
        {
        address lockAndDataERC721 = IContractManagerForMainnet(lockAndDataAddress_).permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        if (!isRAW) {
            uint256 contractPosition = ILockAndDataERC721M(lockAndDataERC721).erc721Mapper(contractHere);
            if (contractPosition == 0) {
                contractPosition = ILockAndDataERC721M(lockAndDataERC721).addERC721Token(contractHere);
                emit ERC721TokenAdded(contractHere, contractPosition);
            }
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

    function sendERC721(address to, bytes calldata data) external allow("DepositBox") returns (bool) {
        address lockAndDataERC721 = IContractManagerForMainnet(lockAndDataAddress_).permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        uint256 contractPosition;
        address contractAddress;
        address receiver;
        uint256 tokenId;
        if (to == address(0)) {
            (contractPosition, receiver, tokenId) = fallbackDataParser(data);
            contractAddress = ILockAndDataERC721M(lockAndDataERC721).erc721Tokens(contractPosition);
        } else {
            (receiver, tokenId) = fallbackRawDataParser(data);
            contractAddress = to;
        }
        return ILockAndDataERC721M(lockAndDataERC721).sendERC721(contractAddress, receiver, tokenId);
    }

    function getReceiver(address to, bytes calldata data) external pure returns (address receiver) {
        uint256 contractPosition;
        uint256 amount;
        if (to == address(0)) {
            (contractPosition, receiver, amount) = fallbackDataParser(data);
        } else {
            (receiver, amount) = fallbackRawDataParser(data);
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