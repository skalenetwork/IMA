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

import {Executor} from "../../../schain/ExecutionLayer/Executor.sol";
import {SwapMock} from "../SwapMock.sol";

contract SwapMockSwap is Executor {
    ExecutorId public constant ID = ExecutorId.wrap(keccak256("SwapMockSwap"));
    SwapMock exchange;

    function setExchange(SwapMock exchangeAddress) external {
        exchange = exchangeAddress;
    }

    function execute(
        TokenInfo[] memory inputTokens,
        bytes memory
    )
        external
        override
        returns (TokenInfo[] memory outputTokens)
    {
        outputTokens = new TokenInfo[](inputTokens.length);
        for (uint256 i = 0; i < inputTokens.length; ++i) {
            IERC20 token = IERC20(getTokenAddress(inputTokens[i]));
            IERC20 anotherToken = exchange.getAnotherToken(token);
            uint256 anotherValue = exchange.swap(token, inputTokens[i].value);
            outputTokens[i].token = address(anotherToken);
            outputTokens[i].value = anotherValue;
        }
    }
}
