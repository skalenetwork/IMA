pragma solidity ^0.5.7;

import "./Permissions.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract LockAndDataForSchainERC20 is Permissions {

    mapping(uint => address) public ERC20Tokens;
    mapping(address => uint) public ERC20Mapper;

    constructor(address lockAndDataAddress) Permissions(lockAndDataAddress) public {
        
    }

    function sendERC20(address contractHere, address to, uint amount) public allow("ERC20Module") returns (bool) {
        require(IERC20(contractHere).balanceOf(address(this)) >= amount, "Not enough money");
        require(IERC20(contractHere).transfer(to, amount), "Could not transfer ERC20 Token");
        return true;
    }

    function addERC20Token(address addressERC20, uint contractPosition) public allow("ERC20Module") {
        ERC20Tokens[contractPosition] = addressERC20;
        ERC20Mapper[addressERC20] = contractPosition;
    }
}