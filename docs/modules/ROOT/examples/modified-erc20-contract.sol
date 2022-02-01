pragma solidity >=0.4.22 <0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";

contract MyERC20 is ERC20Burnable, ERC20Detailed, ERC20Mintable {

    constructor(
      string memory _name,
      string memory _symbol,
      uint256 _decimals
    )
    ERC20Detailed(_name, _symbol, 18)
    public
    {
    }
}