// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Executor.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2024-Present SKALE Labs
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

pragma solidity 0.8.27;

import "hardhat/console.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {TokenInfo} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IActionExecutor.sol";

import {Executor, IExecutionManager} from "../../../schain/ExecutionLayer/Executor.sol";
import {SwapMock} from "../SwapMock.sol";

contract SwapMockSwap is Executor {
    ExecutorId public constant ID = ExecutorId.wrap(keccak256("SwapMockSwap"));
    SwapMock exchange;

    function encodeArguments(address toSwap, uint256 amount) external pure returns (bytes memory encodedArguments) {
        return abi.encode(toSwap, amount);
    }

    function setExchange(SwapMock exchangeAddress) external {
        exchange = exchangeAddress;
    }

    function setExecutionManager(IExecutionManager executionManagerAddress) external {
        executionManager = executionManagerAddress;
    }

    // internal

    function executeWithTokens(
        TokenInfo[] memory inputTokens,
        bytes memory arguments
    )
        internal
        override
        returns (TokenInfo[] memory outputTokens)
    {
        console.log("Execute SwapMockSwap");
        (address toSwap, uint256 amount) = abi.decode(arguments, (address, uint256));
        IERC20 token = IERC20(toSwap);

        if (amount == 0) {
            amount = token.balanceOf(address(this));
        }
        IERC20 anotherToken = exchange.getAnotherToken(token);
        token.approve(address(exchange), amount);
        uint256 anotherValue = exchange.swap(token, amount);
        uint256 finalBalance = token.balanceOf(address(this));
        if (finalBalance > 0) {
            console.log("MISSING TOKENS:", finalBalance);
            outputTokens = new TokenInfo[](inputTokens.length + 1);
            outputTokens[inputTokens.length].token = toSwap;
            outputTokens[inputTokens.length].value = finalBalance;
        } else {
            outputTokens = new TokenInfo[](inputTokens.length);
        }

        for (uint256 i = 0; i < inputTokens.length; ++i) {
            if (inputTokens[i].token == toSwap) {
                outputTokens[i].token = address(anotherToken);
                outputTokens[i].value = anotherValue;
            } else {
                outputTokens[i] = inputTokens[i];
            }
        }
        console.log("Execute SwapMockSwap SUCCEED");
    }
}
