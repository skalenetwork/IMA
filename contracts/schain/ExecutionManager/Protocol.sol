// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Protocol.sol - SKALE Interchain Messaging Agent
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

import {SchainHash} from "@skalenetwork/ima-interfaces/schain/IExecutionManager.sol";

type MetaActionId is bytes32;


library Protocol {

    struct Action {
        bytes data;
    }

    enum MetaActionStatus {
        SUCCEED,
        EXECUTING,
        FAILED
    }

    struct MetaAction {
        SchainHash targetChainHash;
        bytes actions;
        bytes nextMetaAction;
        bytes postActions;
    }

    uint96 constant public VERSION = 1;

    function encodeActions(Action[] memory actions) internal pure returns (bytes memory encodedAction) {
        return abi.encode(actions);
    }

    function decodeActions(bytes memory encodedActions) internal pure returns (Action[] memory actions) {
        return abi.decode(encodedActions, (Action[]));
    }
}
