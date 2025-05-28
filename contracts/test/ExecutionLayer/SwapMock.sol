// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   SwapMock.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaiev
 *
 *   SKALE IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

// Just for tests...
// solhint-disable comprehensive-interface

pragma solidity 0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract SwapMock {
    IERC20 public tokenA;
    IERC20 public tokenB;

    error UnknownToken(IERC20 token);

    function swap(IERC20 token, uint256 amount) external returns (uint256 resultAmount) {
        IERC20 anotherToken = getAnotherToken(token);
        address user = msg.sender;
        require(token.transferFrom(user, address(this), amount), "Token Transfer Failed");
        require(anotherToken.transfer(user, amount), "Token Transfer Failed");

        return amount;
    }

    function setTokenA(IERC20 token) external {
        tokenA = token;
    }

    function setTokenB(IERC20 token) external {
        tokenB = token;
    }

    // public

    function getAnotherToken(IERC20 token) public view returns (IERC20 anotherToken) {
        require(tokenA == token || tokenB == token, UnknownToken(token));
        if (token == tokenA) {
            return tokenB;
        } else if (token == tokenB) {
            return tokenA;
        } else {
            revert UnknownToken(token);
        }
    }
}
