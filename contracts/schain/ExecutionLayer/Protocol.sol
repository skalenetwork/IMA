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


import {SchainHash} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {ProtocolTypes as PT, MetaActionId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ProtocolTypes.sol";


library Protocol {

    uint96 constant public VERSION = 1;

    error IncompatibleVersion(
        uint96 version
    );

    error UnknownMessageType(
        PT.MessageType messageType
    );

    error IncorrectMessageType(
        PT.MessageType received,
        PT.MessageType required
    );


    function empty(PT.MetaAction storage metaAction) internal view returns (bool result) {
        return SchainHash.unwrap(metaAction.targetChainHash) != bytes32(0);
    }

    function hasNextMetaAction(PT.MetaAction storage metaAction) internal view returns (bool result) {
        return metaAction.nextMetaAction.length > 0;
    }

    function encodeActions(PT.Action[] memory actions) internal pure returns (bytes memory encodedAction) {
        return abi.encode(actions);
    }

    function decodeMetaAction(bytes memory encodedMetaAction) internal pure returns (PT.MetaAction memory metaAction) {
        return abi.decode(encodedMetaAction, (PT.MetaAction));
    }

    function encodeMetaAction(PT.MetaAction memory metaAction) internal pure returns (bytes memory encodedMetaAction) {
        return abi.encode(metaAction);
    }

    function decodeActions(bytes memory encodedActions) internal pure returns (PT.Action[] memory actions) {
        if (encodedActions.length == 0) {
            return new PT.Action[](0);
        }
        return abi.decode(encodedActions, (PT.Action[]));
    }

    function encodeMetaActionMessage(
        MetaActionId id,
        PT.MetaAction memory metaAction,
        PT.TokenInfo[] memory tokens,
        address tokensOwner,
        uint256 seqNumber
    )
        internal
        pure
        returns (bytes memory message)
    {
        return abi.encode(PT.Message({
            version: VERSION,
            messageType: PT.MessageType.META_ACTION,
            metaActionId: id,
            payload: abi.encode(metaAction, tokens),
            tokensOwner: tokensOwner,
            seqNumber: seqNumber
        }));
    }

    function decodeMetaActionMessage(
        PT.Message memory message
    )
        internal
        pure
        returns (PT.MetaAction memory metaAction, PT.TokenInfo[] memory tokens)
    {
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
        if (message.messageType != PT.MessageType.META_ACTION) {
            revert IncorrectMessageType(message.messageType, PT.MessageType.META_ACTION);
        }
        return abi.decode(message.payload, (PT.MetaAction, PT.TokenInfo[]));
    }

    function encodeConfirmationMessage(
        MetaActionId id,
        SchainHash schainHash,
        PT.TokenInfo[] memory tokens
    )
        internal
        pure
        returns (bytes memory encodedConfirmation)
    {
        return abi.encode(PT.Message({
            version: VERSION,
            messageType: PT.MessageType.CONFIRMATION,
            metaActionId: id,
            payload: abi.encode(schainHash, tokens),
            tokensOwner: address(0),
            seqNumber: 0
        }));
    }

    function decodeConfirmationMessage(
        PT.Message memory message
    )
        internal
        pure
        returns (SchainHash sourceSchain, PT.TokenInfo[] memory tokens)
    {
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
        if (message.messageType != PT.MessageType.CONFIRMATION) {
            revert IncorrectMessageType(message.messageType, PT.MessageType.CONFIRMATION);
        }
        return abi.decode(message.payload, (SchainHash, PT.TokenInfo[]));
    }

    function decodeMessage(bytes memory encodedMessage) internal pure returns (PT.Message memory message) {
        message = abi.decode(encodedMessage, (PT.Message));
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
    }

    function isZero(MetaActionId id) internal pure returns (bool result) {
        return MetaActionId.unwrap(id) == bytes32(0);
    }
}
