pragma solidity ^0.5.0;

import "./Permissions.sol";

interface ERC20MintAndBurn {
    function balanceOf(address to) external view returns (uint);
    function mint(address to, uint amount) external returns (bool);
    function burn(uint amount) external;
}

contract LockAndDataForSchainERC20 is Permissions {

    mapping(uint => address) public ERC20Tokens;
    mapping(address => uint) public ERC20Mapper;

    constructor(address lockAndDataAddress) Permissions(lockAndDataAddress) public {

    }

    function sendERC20(address contractHere, address to, uint amount) public allow("ERC20Module") returns (bool) {
        require(ERC20MintAndBurn(contractHere).mint(to, amount), "Could not mint ERC20 Token");
        return true;
    }

    function receiveERC20(address contractHere, uint amount) public allow("ERC20Module") returns (bool) {
        require(ERC20MintAndBurn(contractHere).balanceOf(address(this)) >= amount, "Amount not transfered");
        ERC20MintAndBurn(contractHere).burn(amount);
        return true;
    }

    function addERC20Token(address addressERC20, uint contractPosition) public allow("ERC20Module") {
        ERC20Tokens[contractPosition] = addressERC20;
        ERC20Mapper[addressERC20] = contractPosition;
    }
}