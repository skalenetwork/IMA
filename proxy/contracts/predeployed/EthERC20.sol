/**
 *   EthERC20.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE-IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE-IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE-IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "./OwnableForSchain.sol";


/*
// l_sergiy: new contract - LockAndDataOwnable - because owner should be lockAndDataAddress
*/
import "./LockAndDataOwnable.sol";


contract EthERC20 is LockAndDataOwnable, ERC20 {

    bool private _initialized = false;
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _capacity;


    constructor() public {
        delayedInit();
    }

    function mint(address account, uint256 amount) external onlyOwner returns (bool) {
        delayedInit();
        require(totalSupply().add(amount) <= _capacity, "Capacity exceeded");
        _mint(account, amount);
        return true;
    }

    function burn(uint256 amount) external {
        delayedInit();
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external onlyOwner {
        delayedInit();
        _burn(account, amount);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function delayedInit() internal {
        if (_initialized) {
            return;
        }
        _initialized = true;
        _name = "ERC20 Ether Clone";
        _symbol = "ETHC";
        _decimals = 18;
        _capacity = 120 * (10 ** 6) * (10 ** 18);
    }

}
