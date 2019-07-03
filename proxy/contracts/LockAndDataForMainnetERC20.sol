/**
 *   LockAndDataForMainnetERC20.sol - SKALE Interchain Messaging Agent
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

pragma solidity ^0.5.7;

import "./Permissions.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract LockAndDataForMainnetERC20 is Permissions {

    mapping(uint => address) public ERC20Tokens;
    mapping(address => uint) public ERC20Mapper;
    uint newIndexERC20 = 1;

    constructor(address lockAndDataAddress) Permissions(lockAndDataAddress) public {
        
    }

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