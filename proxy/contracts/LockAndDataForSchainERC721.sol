pragma solidity ^0.5.0;

import "./Permissions.sol";

interface ERC721MintAndBurn {
    function ownerOf(uint tokenId) external view returns (address);
    function mint(address to, uint tokenId) external returns (bool);
    function burn(uint tokenId) external;
}

contract LockAndDataForSchainERC721 is Permissions {

    mapping(uint => address) public ERC721Tokens;
    mapping(address => uint) public ERC721Mapper;
    // mapping(uint => uint) public mintToken;

    constructor(address lockAndDataAddress) Permissions(lockAndDataAddress) public {

    }

    function sendERC721(address contractHere, address to, uint tokenId) public allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractHere).mint(to, tokenId), "Could not mint ERC721 Token");
        return true;
    }

    function receiveERC721(address contractHere, uint tokenId) public allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractHere).ownerOf(tokenId) == address(this), "Token not transfered");
        ERC721MintAndBurn(contractHere).burn(tokenId);
        return true;
    }

    function addERC721Token(address addressERC721, uint contractPosition) public allow("ERC721Module") {
        ERC721Tokens[contractPosition] = addressERC721;
        ERC721Mapper[addressERC721] = contractPosition;
    }
}