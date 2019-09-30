/**
 *   LockAndDataForSchainERC20.sol - SKALE Interchain Messaging Agent
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

import "./Permissions.sol";

interface ERC20MintAndBurn {
    function balanceOf(address to) external view returns (uint);
    function mint(address to, uint amount) external returns (bool);
    function burn(uint amount) external;
}


contract LockAndDataForSchainERC20 is Permissions {

    event SendedERC20(bool result);
    event ReceivedERC20(bool result);

    mapping(uint => address) public erc20Tokens;
    mapping(address => uint) public erc20Mapper;

    constructor(address _lockAndDataAddress) Permissions(_lockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function sendERC20(address contractHere, address to, uint amount) external allow("ERC20Module") returns (bool) {
        require(ERC20MintAndBurn(contractHere).mint(to, amount), "Could not mint ERC20 Token");
        emit SendedERC20(true);
        return true;
    }

    function receiveERC20(address contractHere, uint amount) external allow("ERC20Module") returns (bool) {
        require(ERC20MintAndBurn(contractHere).balanceOf(address(this)) >= amount, "Amount not transfered");
        ERC20MintAndBurn(contractHere).burn(amount);
        emit ReceivedERC20(true);
        return true;
    }

    function addERC20Token(address addressERC20, uint contractPosition) external allow("ERC20Module") {
        erc20Tokens[contractPosition] = addressERC20;
        erc20Mapper[addressERC20] = contractPosition;
    }
}