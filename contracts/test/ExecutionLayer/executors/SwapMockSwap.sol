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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {ProtocolTypes} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ProtocolTypes.sol";

import {Executor, IExecutionManager} from "../../../schain/ExecutionLayer/Executor.sol";
import {SwapMock} from "../SwapMock.sol";

contract SwapMockSwap is Executor {
    ExecutorId public constant ID = ExecutorId.wrap(keccak256("SwapMockSwap"));
    SwapMock public exchange;

    // Executor-specific function
    // solhint-disable-next-line comprehensive-interface
    function setExchange(SwapMock exchangeAddress) external {
        exchange = exchangeAddress;
    }

    // Executor-specific function
    // solhint-disable-next-line comprehensive-interface
    function setExecutionManager(IExecutionManager executionManagerAddress) external {
        executionManager = executionManagerAddress;
    }

    // Input depends on each Executor
    // solhint-disable-next-line comprehensive-interface
    function encodeArguments(address toSwap, uint256 amount) external pure returns (bytes memory encodedArguments) {
        return abi.encode(toSwap, amount);
    }

    // internal

    function _executeWithTokens(
        ProtocolTypes.TokenInfo[] memory inputTokens,
        bytes memory arguments
    )
        internal
        override
        returns (ProtocolTypes.TokenInfo[] memory outputTokens)
    {
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
            outputTokens = new ProtocolTypes.TokenInfo[](inputTokens.length + 1);
            outputTokens[inputTokens.length].token = toSwap;
            outputTokens[inputTokens.length].value = finalBalance;
        } else {
            outputTokens = new ProtocolTypes.TokenInfo[](inputTokens.length);
        }

        // mindblowing .. but it's a mock so :(
        for (uint256 i = 0; i < inputTokens.length; ++i) {
            if (inputTokens[i].token == address(anotherToken)) {
                outputTokens[i] = inputTokens[i];
                outputTokens[i].value += anotherValue;
                anotherValue = 0;
            } else if (inputTokens[i].token == toSwap) {
                outputTokens[i].token = address(anotherToken);
                outputTokens[i].value = anotherValue;
            } else {
                outputTokens[i] = inputTokens[i];
            }
        }
    }
}
