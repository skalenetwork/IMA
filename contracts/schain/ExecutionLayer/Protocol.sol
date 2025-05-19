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

import "hardhat/console.sol";

import {SchainHash} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {TokenInfo} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IActionExecutor.sol";

type MetaActionId is bytes32;


library Protocol {

    struct Action {
        ExecutorId executor;
        bytes arguments;
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

    enum MessageType {
        CONFIRMATION,
        META_ACTION,
        FAILURE
    }

    struct Message {
        uint96 version;
        MessageType messageType;
        MetaActionId metaActionId;
        uint256 seqNumber;
        address tokensOwner;
        bytes payload;
    }

    uint96 constant public VERSION = 1;

    error IncompatibleVersion(
        uint96 version
    );

    error UnknownMessageType(
        MessageType messageType
    );

    error IncorrectMessageType(
        MessageType received,
        MessageType required
    );

    function encodeActions(Action[] memory actions) internal pure returns (bytes memory encodedAction) {
        return abi.encode(actions);
    }

    function decodeMetaAction(bytes memory encodedMetaAction) internal pure returns (MetaAction memory metaAction) {
        return abi.decode(encodedMetaAction, (MetaAction));
    }

    function encodeMetaAction(MetaAction memory metaAction) internal pure returns (bytes memory encodedMetaAction) {
        return abi.encode(metaAction);
    }

    function decodeActions(bytes memory encodedActions) internal pure returns (Action[] memory actions) {
        if (encodedActions.length == 0) {
            return new Action[](0);
        }
        return abi.decode(encodedActions, (Action[]));
    }

    function encodeMetaActionMessage(
        MetaActionId id,
        MetaAction memory metaAction,
        TokenInfo[] memory tokens,
        address tokensOwner,
        uint256 seqNumber
    )
        internal
        pure
        returns (bytes memory message)
    {
        return abi.encode(Message({
            version: VERSION,
            messageType: MessageType.META_ACTION,
            metaActionId: id,
            payload: abi.encode(metaAction, tokens),
            tokensOwner: tokensOwner,
            seqNumber: seqNumber
        }));
    }

    function decodeMetaActionMessage(
        Message memory message
    )
        internal
        pure
        returns (MetaAction memory metaAction, TokenInfo[] memory tokens)
    {
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
        if (message.messageType != MessageType.META_ACTION) {
            revert IncorrectMessageType(message.messageType, MessageType.META_ACTION);
        }
        return abi.decode(message.payload, (MetaAction, TokenInfo[]));
    }

    function encodeConfirmationMessage(
        MetaActionId id,
        SchainHash schainHash,
        TokenInfo[] memory tokens
    )
        internal
        pure
        returns (bytes memory encodedConfirmation)
    {
        return abi.encode(Message({
            version: VERSION,
            messageType: MessageType.CONFIRMATION,
            metaActionId: id,
            payload: abi.encode(schainHash, tokens),
            tokensOwner: address(0),
            seqNumber: 0
        }));
    }

    /* Out of scope
    function encodeFailureMessage(
        MetaActionId id,
        SchainHash schainHash,
        TokenInfo[] memory tokens
    )
        internal
        pure
        returns (bytes memory encodedConfirmation)
    {
        return abi.encode(Message({
            version: VERSION,
            messageType: MessageType.FAILURE,
            metaActionId: id,
            payload: abi.encode(schainHash, tokens),
            tokensOwner: address(0),
            seqNumber: 0
        }));
    }*/

    function decodeConfirmationMessage(
        Message memory message
    )
        internal
        pure
        returns (SchainHash sourceSchain, TokenInfo[] memory tokens)
    {
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
        if (message.messageType != MessageType.CONFIRMATION) {
            revert IncorrectMessageType(message.messageType, MessageType.CONFIRMATION);
        }
        return abi.decode(message.payload, (SchainHash, TokenInfo[]));
    }

    /* Out of scope
    function decodeFailureMessage(
        Message memory message
    )
        internal
        pure
        returns (SchainHash sourceSchain, TokenInfo[] memory tokens)
    {
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
        if (message.messageType != MessageType.FAILURE) {
            revert IncorrectMessageType(message.messageType, MessageType.FAILURE);
        }
        return abi.decode(message.payload, (SchainHash, TokenInfo[]));
    }
    */

    function decodeMessage(bytes memory encodedMessage) internal pure returns (Message memory message) {
        message = abi.decode(encodedMessage, (Message));
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
    }

    function isZero(MetaActionId id) internal pure returns (bool result) {
        return MetaActionId.unwrap(id) == bytes32(0);
    }

    function empty(MetaAction storage metaAction) internal view returns (bool result) {
        return SchainHash.unwrap(metaAction.targetChainHash) != bytes32(0);
    }

    function hasNextMetaAction(Protocol.MetaAction storage metaAction) internal view returns (bool result) {
        return metaAction.nextMetaAction.length > 0;
    }
}
