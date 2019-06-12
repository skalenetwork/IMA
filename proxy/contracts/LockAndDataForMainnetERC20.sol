pragma solidity ^0.5.7;

import "./Permissions.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract LockAndDataForMainnetERC20 is Permissions {

    mapping(uint => address) public ERC20Tokens;
    mapping(address => uint) public ERC20Mapper;
    uint newIndexERC20 = 1;

    constructor(address lockAndDataAddress) Permissions(lockAndDataAddress) public;

    function sendERC20(address contractHere, address to, uint amount) public allow("ERC20Module") returns (bool) {
        require(IERC20(contractHere).balanceOf(address(this)) >= amount, "Not enough money");
        require(IERC20(contractHere).transfer(to, amount));
        return true;
    }

    function addERC20Token(address addressERC20) public allow("ERC20Module") returns (uint) {
        uint index = newIndexERC20;
        ERC20Tokens[index] = addressERC20;
        ERC20Mapper[addressERC20] = index;
        newIndexERC20++;
        return index;
    }
}