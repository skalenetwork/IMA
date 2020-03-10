pragma solidity ^0.5.3;

import "./PermissionsForSchain.sol";

interface ERC721MintAndBurn {
    function ownerOf(uint256 tokenId) external view returns (address);
    function mint(address to, uint256 tokenId) external returns (bool);
    function burn(uint256 tokenId) external;
}


contract LockAndDataForSchainERC721 is PermissionsForSchain {

    event SendERC721(bool result);
    event ReceiveERC721(bool result);

    mapping(uint256 => address) public erc721Tokens;
    mapping(address => uint256) public erc721Mapper;
    // mapping(uint256 => uint256) public mintToken;


    constructor(address _lockAndDataAddress) PermissionsForSchain(_lockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function sendERC721(address contractHere, address to, uint256 tokenId) external allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractHere).mint(to, tokenId), "Could not mint ERC721 Token");
        emit SendERC721(true);
        return true;
    }

    function receiveERC721(address contractHere, uint256 tokenId) external allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractHere).ownerOf(tokenId) == address(this), "Token not transfered");
        ERC721MintAndBurn(contractHere).burn(tokenId);
        emit ReceiveERC721(true);
        return true;
    }

    function addERC721Token(address addressERC721, uint256 contractPosition) external allow("ERC721Module") {
        erc721Tokens[contractPosition] = addressERC721;
        erc721Mapper[addressERC721] = contractPosition;
    }
}
