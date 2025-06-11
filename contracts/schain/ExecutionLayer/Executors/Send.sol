// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Send.sol - SKALE Interchain Messaging Agent
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

import {Executor} from "../Executor.sol";

contract Send is Executor {
    ExecutorId public constant ID = ExecutorId.wrap(keccak256("Send"));

    // Input depends on each Executor
    // solhint-disable-next-line comprehensive-interface
    function encodeArguments(address receiver) external pure returns (bytes memory encodedArguments) {
        return abi.encode(receiver);
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
        address target = abi.decode(arguments, (address));
        for (uint256 i = 0; i < inputTokens.length; ++i) {
            IERC20 token = IERC20(_getTokenAddress(inputTokens[i]));
            require(
                token.transfer(target, inputTokens[i].value),
                "Token Transfer Failed"
            );
        }
        return new ProtocolTypes.TokenInfo[](0);
    }
}
