pragma solidity ^0.5.3;


interface IERC721Module {
    function receiveERC721(
        address contractHere,
        address to,
        uint tokenId,
        bool isRaw) external returns (bytes memory);
    function sendERC721(address to, bytes calldata data) external returns (bool);
    function getReceiver(address to, bytes calldata data) external pure returns (address);
}