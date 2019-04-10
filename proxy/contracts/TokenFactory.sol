pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Capped.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';

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

contract TokenFactory {

    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        owner = newOwner;
    }

    function createERC20(bytes data) public onlyOwner returns (address) {
        string memory name;
        string memory symbol;
        uint8 decimals;
        uint256 totalSupply;
        (name, symbol, decimals, totalSupply) = fallbackDataCreateERC20Parser(data);
        ERC20OnChain newERC20 = new ERC20OnChain(name, symbol, decimals, totalSupply);
        newERC20.mint(msg.sender, totalSupply);
        return address(newERC20);
    }

    function fallbackDataCreateERC20Parser(bytes data) 
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
            nameLength := mload(add(data, 65))
        }
        name = new string(uint(nameLength));
        for (uint i = 0; i < uint(nameLength); i++) {
            bytes(name)[i] = data[65 + i];
        }
        uint lengthOfName = uint(nameLength);
        assembly {
            symbolLength := mload(add(data, add(97, lengthOfName)))
        }
        symbol = new string(uint(symbolLength));
        for (i = 0; i < uint(symbolLength); i++) {
            bytes(symbol)[i] = data[97 + lengthOfName + i];
        }
        uint lengthOfSymbol = uint(symbolLength);
        assembly {
            decimals := mload(add(data, 
                add(129, add(lengthOfName, lengthOfSymbol))))
            totalSupply := mload(add(data, 
                add(130, add(lengthOfName, lengthOfSymbol))))
        }
        return (
            name, 
            symbol, 
            uint8(decimals), 
            uint256(totalSupply)
            );
    }
}