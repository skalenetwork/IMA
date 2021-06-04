// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Messages.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaeiv
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;


library CustomMessages {
    enum MessageType {
        EMPTY,
        EXAMPLE
    }

    struct BaseMessage {
        MessageType messageType;
    }

    struct ExampleMessage {
        BaseMessage message;
        uint number;
    }

     function encodeExampleMessage(uint number) internal pure returns (bytes memory) {
        ExampleMessage memory message = ExampleMessage(
            BaseMessage(MessageType.EXAMPLE),
            number
        );
        return abi.encode(message);
    }

    function decodeExampleMessage(bytes calldata data) internal pure returns (ExampleMessage memory) {
        require(getMessageType(data) == MessageType.EXAMPLE, "Message type is not Example");
        return abi.decode(data, (ExampleMessage));
    }

    function getMessageType(bytes calldata data) internal pure returns (MessageType) {
        uint256 firstWord = abi.decode(data, (uint256));
        if (firstWord % 32 == 0) {
            return getMessageType(data[firstWord:]);
        } else {
            return abi.decode(data, (MessageType));
        }
    }

}