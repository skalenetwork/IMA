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

pragma solidity ^0.5.3;


import "./PermissionsForMainnet.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract LockAndDataForMainnetERC20 is PermissionsForMainnet {

    mapping(uint256 => address) public erc20Tokens;
    mapping(address => uint256) public erc20Mapper;
    uint256 newIndexERC20 = 1;

    constructor(address _lockAndDataAddress) PermissionsForMainnet(_lockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function sendERC20(address contractHere, address to, uint256 amount) external allow("ERC20Module") returns (bool) {
        require(IERC20(contractHere).balanceOf(address(this)) >= amount, "Not enough money");
        require(IERC20(contractHere).transfer(to, amount), "something went wrong with `transfer` in ERC20");
        return true;
    }

    function addERC20Token(address addressERC20) external allow("ERC20Module") returns (uint256) {
        uint256 index = newIndexERC20;
        erc20Tokens[index] = addressERC20;
        erc20Mapper[addressERC20] = index;
        newIndexERC20++;
        return index;
    }
}