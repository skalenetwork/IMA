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


contract EthERC20 is LockAndDataOwnable, IERC20, ERC20 {

    bool private initialized_ = false;
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint private CAP_;


    constructor() public {
        // solium-disable-previous-line no-empty-blocks
        delayed_init();
    }

    function mint(address account, uint256 amount) external onlyOwner returns (bool) {
        delayed_init();
        require(totalSupply().add(amount) <= CAP_, "Cap exceeded");
        _mint(account, amount);
        return true;
    }

    function burn(uint256 amount) external {
        delayed_init();
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }

    function delayed_init() internal {
        if (initialized_) {
            return;
        }
        initialized_ = true;
        _name = "ERC20 Ether Clone";
        _symbol = "ETHC";
        _decimals = 18;
        CAP_ = 120 * (10 ** 6) * (10 ** 18);
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
}
