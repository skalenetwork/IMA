pragma solidity ^0.5.3;

import "./PermissionsForSchain.sol";

interface ERC721MintAndBurn {
    function ownerOf(uint tokenId) external view returns (address);
    function mint(address to, uint tokenId) external returns (bool);
    function burn(uint tokenId) external;
}


contract LockAndDataForSchainERC721 is Permissions {

    event SendERC721(bool result);
    event ReceiveERC721(bool result);

    mapping(uint => address) public erc721Tokens;
    mapping(address => uint) public erc721Mapper;
    // mapping(uint => uint) public mintToken;

    bool isVariablesSet = false;

    modifier setVariables() {
        if (!isVariablesSet) {
            address newLockAndData;
            address newOwner;
            assembly {
                newLockAndData := sload(0x00)
                newOwner := sload(0x01)
            }
            lockAndDataAddress_ = newLockAndData;

            // l_sergiy: owner can be changed only via contract Ownable -> transferOwnership()
            setOwner( newOwner );

            isVariablesSet = true;
        }
        _;
    }

    function sendERC721(address contractHere, address to, uint tokenId) external setVariables allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractHere).mint(to, tokenId), "Could not mint ERC721 Token");
        emit SendERC721(true);
        return true;
    }

    function receiveERC721(address contractHere, uint tokenId) external setVariables allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractHere).ownerOf(tokenId) == address(this), "Token not transfered");
        ERC721MintAndBurn(contractHere).burn(tokenId);
        emit ReceiveERC721(true);
        return true;
    }

    function addERC721Token(address addressERC721, uint contractPosition) external setVariables allow("ERC721Module") {
        erc721Tokens[contractPosition] = addressERC721;
        erc721Mapper[addressERC721] = contractPosition;
    }
}
