pragma solidity ^0.5.0;

import "./Permissions.sol";
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Capped.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';
import 'openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol';
import 'openzeppelin-solidity/contracts/token/ERC721/ERC721MetadataMintable.sol';

contract ERC20OnChain is ERC20Detailed, ERC20Capped {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 cap
        )
        ERC20Detailed(name, symbol, decimals)
        ERC20Capped(cap)
        public
    {

    }
}

contract ERC721OnChain is ERC721Full, ERC721MetadataMintable {
    constructor(
        string memory name,
        string memory symbol
        )
        ERC721Full(name, symbol)
        public
    {

    }

    function mint(address to, uint256 tokenId)
        public
        onlyMinter
        returns (bool)
    {
        _mint(to, tokenId);
        return true;
    }

    function setTokenURI(uint256 tokenId, string memory tokenURI)
        public
        returns (bool)
    {
        require(_exists(tokenId));
        require(_isApprovedOrOwner(msg.sender, tokenId));
        _setTokenURI(tokenId, tokenURI);
        return true;
    }
}

contract TokenFactory is Permissions{

    constructor(address lockAndDataAddress) Permissions(lockAndDataAddress) public {
    }

    function createERC20(bytes memory data)
        public
        allow("ERC20Module")
        returns (address)
    {
        string memory name;
        string memory symbol;
        uint8 decimals;
        uint256 totalSupply;
        (name, symbol, decimals, totalSupply) =
            fallbackDataCreateERC20Parser(data);
        ERC20OnChain newERC20 = new ERC20OnChain(
            name,
            symbol,
            decimals,
            totalSupply
        );
        address lockAndDataERC20 = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        newERC20.mint(lockAndDataERC20, totalSupply);
        newERC20.addMinter(lockAndDataERC20);
        newERC20.renounceMinter();
        return address(newERC20);
    }

    function createERC721(bytes memory data)
        public
        allow("ERC721Module")
        returns (address)
    {
        string memory name;
        string memory symbol;
        (name, symbol) = fallbackDataCreateERC721Parser(data);
        ERC721OnChain newERC721 = new ERC721OnChain(name, symbol);
        address lockAndDataERC721 = ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        newERC721.addMinter(lockAndDataERC721);
        newERC721.renounceMinter();
        return address(newERC721);
    }

    function fallbackDataCreateERC20Parser(bytes memory data)
        internal
        pure
        returns (
            string memory name,
            string memory symbol,
            uint8,
            uint256
        )
    {
        bytes1 decimals;
        bytes32 totalSupply;
        bytes32 nameLength;
        bytes32 symbolLength;
        assembly {
            nameLength := mload(add(data, 129))
        }
        name = new string(uint(nameLength));
        for (uint i = 0; i < uint(nameLength); i++) {
            bytes(name)[i] = data[129 + i];
        }
        uint lengthOfName = uint(nameLength);
        assembly {
            symbolLength := mload(add(data, add(161, lengthOfName)))
        }
        symbol = new string(uint(symbolLength));
        for (uint i = 0; i < uint(symbolLength); i++) {
            bytes(symbol)[i] = data[161 + lengthOfName + i];
        }
        uint lengthOfSymbol = uint(symbolLength);
        assembly {
            decimals := mload(add(data,
                add(193, add(lengthOfName, lengthOfSymbol))))
            totalSupply := mload(add(data,
                add(194, add(lengthOfName, lengthOfSymbol))))
        }
        return (
            name,
            symbol,
            uint8(decimals),
            uint256(totalSupply)
            );
    }

    function fallbackDataCreateERC721Parser(bytes memory data)
        internal
        pure
        returns (
            string memory name,
            string memory symbol
        )
    {
        bytes32 nameLength;
        bytes32 symbolLength;
        assembly {
            nameLength := mload(add(data, 129))
        }
        name = new string(uint(nameLength));
        for (uint i = 0; i < uint(nameLength); i++) {
            bytes(name)[i] = data[129 + i];
        }
        uint lengthOfName = uint(nameLength);
        assembly {
            symbolLength := mload(add(data, add(161, lengthOfName)))
        }
        symbol = new string(uint(symbolLength));
        for (uint i = 0; i < uint(symbolLength); i++) {
            bytes(symbol)[i] = data[161 + lengthOfName + i];
        }
    }
}