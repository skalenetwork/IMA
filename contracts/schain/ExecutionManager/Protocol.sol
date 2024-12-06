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

    struct Confirmation {
        MetaActionId metaActionId; // TODO: remove or replace
    }

    enum MessageType {
        CONFIRMATION,
        META_ACTION
    }

    struct Message {
        uint96 version;
        MessageType messageType;
        MetaActionId metaActionId;
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
        return abi.decode(encodedActions, (Action[]));
    }

    function encodeMetaActionMessage(MetaActionId id, MetaAction memory metaAction) internal pure returns (bytes memory message) {
        return abi.encode(Message({
            version: VERSION,
            messageType: MessageType.META_ACTION,
            metaActionId: id,
            payload: encodeMetaAction(metaAction)
        }));
    }

    function decodeMetaActionMessage(Message memory message) internal pure returns (MetaAction memory metaAction) {
        if (message.version != VERSION) {
            revert IncompatibleVersion(message.version);
        }
        if (message.messageType != MessageType.META_ACTION) {
            revert IncorrectMessageType(message.messageType, MessageType.META_ACTION);
        }
        return abi.decode(message.payload, (MetaAction));
    }

    function encodeConfirmationMessage(MetaActionId id, Confirmation memory confirmation) internal pure returns (bytes memory encodedConfirmation) {
        return abi.encode(Message({
            version: VERSION,
            messageType: MessageType.CONFIRMATION,
            metaActionId: id,
            payload: abi.encode(confirmation)
        }));
    }

    function decodeMessage(bytes memory encodedMessage) internal pure returns (Message memory message) {
        console.log("in decodeMessage");
        message = abi.decode(encodedMessage, (Message));
        console.log("after decode");
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
