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

    struct Confirmation {
        MetaActionId metaActionId;
    }

    enum MessageType {
        CONFIRMATION,
        META_ACTION
    }

    struct Message {
        uint96 version;
        MessageType messageType;
        bytes data;
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

    function decodeActions(bytes memory encodedActions) internal pure returns (Action[] memory actions) {
        return abi.decode(encodedActions, (Action[]));
    }

    function encodeMetaAction(MetaAction storage metaAction) internal view returns (bytes memory message) {
        return abi.encode(Message({
            version: VERSION,
            messageType: MessageType.META_ACTION,
            data: abi.encode(metaAction)
        }));
    }

    function decodeMetaAction(bytes memory rawMessage) internal view returns (MetaAction memory metaAction) {
        Message memory message = abi.decode(rawMessage, [Message]);
        if (message.version != VERSION) {
            revert IncompatibleVersion(version);
        }
        if (message.messageType != MessageType.META_ACTION) {
            revert IncorrectMessageType(message.messageType, MessageType.META_ACTION);
        }
        return abi.decode(message.data, [MetaAction]);
    }

    function encodeConfirmation(Confirmation memory confirmation) internal pure returns (bytes encodedConfirmation) {
        return abi.encode([VERSION, confirmation]);
    }

    function getMessageType(bytes memory message) internal pure returns (MessageType messageType) {
        (uint96 version, messageType) = abi.decode(message, [uint96, MessageType]);
        if (version != VERSION) {
            revert IncompatibleVersion(version);
        }
    }

    function isZero(MetaActionId id) internal pure returns (bool result) {
        return MetaActionId.unwrap(id) == bytes32(0);
    }

    function empty(MetaAction storage metaAction) internal view returns (bool result) {
        return metaAction.targetChainHash
    }
}
