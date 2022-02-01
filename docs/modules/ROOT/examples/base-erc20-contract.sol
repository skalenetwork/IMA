pragma solidity >=0.4.22 <0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";

interface tokenRecipient {
    function receiveApproval(address _from, uint256 _value, address _token, bytes calldata _extraData) external;
}

contract MyERC20 is ERC20, ERC20Detailed, ERC20Mintable{

    constructor(
    uint256 _amount,
    string memory _name,
    string memory _symbol,
    uint256 _decimals

  )
    ERC20Detailed(_name, _symbol, 18)
    public
  {
    require(_amount > 0, "amount has to be greater than 0");
    _mint(msg.sender, _amount.mul(10 ** uint256(_decimals)));
    }
}