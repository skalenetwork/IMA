pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';
import "./Ownable.sol";

contract EthERC20 is Ownable, ERC20Detailed, ERC20 {

    uint private cap = 120 * (10 ** 6) * (10 ** 18);

    constructor() ERC20Detailed("ERC20 Ether Clone", "ETHC", 18) public {

    }

    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
        require(totalSupply().add(amount) <= cap, "Cap exceeded");
        _mint(account, amount);
        return true;
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) onlyOwner public {
        _burn(account, amount);
    }
}