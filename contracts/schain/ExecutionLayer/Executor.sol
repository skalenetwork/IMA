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

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IExecutionManager} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {IExecutor} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {TokenInfo} from "./Protocol.sol";


abstract contract Executor is Initializable, IExecutor {
    IExecutionManager public executionManager;

    function initialize(IExecutionManager executionManagerAddress) external initializer {
        executionManager = executionManagerAddress;
    }

    function execute(
        TokenInfo[] memory inputTokens,
        bytes memory arguments
    )
        external
        override
        returns (TokenInfo[] memory outputTokens)
    {
        for (uint256 i = 0; i < inputTokens.length; ++i) {
            IERC20 token = IERC20(inputTokens[i].token);
            token.transferFrom(address(executionManager), address(this), inputTokens[i].value);
        }
        outputTokens = pruneTokens(
            executeWithTokens(inputTokens, arguments)
        );
        console.log("executed");
        for (uint256 i = 0; i < outputTokens.length; ++i) {
            IERC20 token = IERC20(getTokenAddress(outputTokens[i]));
            token.transfer(address(executionManager), inputTokens[i].value);
        }
        console.log("tokens returned to the executor");
    }

    // internal

    function executeWithTokens(
        TokenInfo[] memory inputTokens,
        bytes memory
    )
        internal
        virtual
        returns (TokenInfo[] memory outputTokens)
    {
        return inputTokens;
    }

    function getTokenAddress(TokenInfo memory tokenInfo) internal view returns (address) {
        return executionManager.getTokenAddress(tokenInfo);
    }

    function copyTokens(TokenInfo[] memory tokenInfo) internal pure returns (TokenInfo[] memory tokenInfoCopy) {
        tokenInfoCopy = new TokenInfo[](tokenInfo.length);
        for (uint256 i = 0; i < tokenInfo.length; ++i) {
            tokenInfoCopy[i] = tokenInfo[i];
        }
    }

    function pruneTokens(TokenInfo[] memory tokenInfo) internal pure returns (TokenInfo[] memory tokenInfoPruned) {
        uint256 count = 0;
        for (uint256 i = 0; i < tokenInfo.length; ++i) {
            if (tokenInfo[i].value > 0) {
                ++count;
            }
        }
        if (count == tokenInfo.length) {
            return tokenInfo;
        }
        tokenInfoPruned = new TokenInfo[](count);
        count = 0;
        for (uint256 i = 0; i < tokenInfo.length; ++i) {
            if (tokenInfo[i].value > 0) {
                tokenInfoPruned[count] = tokenInfo[i];
                ++count;
            }
        }
    }
}
