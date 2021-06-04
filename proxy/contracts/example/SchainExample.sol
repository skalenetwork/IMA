// SPDX-License-Identifier: AGPL-3.0-only

/*
    CommunityLocker.sol - SKALE Manager
    Copyright (C) 2021-Present SKALE Labs
    @author Dmytro Stebaiev
    @author Artem Payvin
    @author Vadim Yavorsky

    SKALE Manager is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SKALE Manager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with SKALE Manager.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./CustomMessages.sol";
import "../schain/MessageProxyForSchain.sol";

contract SchainExample  {

    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));

    MessageProxyForSchain public messageProxy;
    address public mainnetExample;
    bytes32 public schainHash;

    uint public number;

    event ExampleEvent(bytes32 schainHash, uint number);    

    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        returns (bool)
    {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        require(sender == mainnetExample, "Sender must be MainnetExample");
        require(fromChainHash == MAINNET_HASH, "Source chain name must be Mainnet");
        CustomMessages.MessageType operation = CustomMessages.getMessageType(data);
        require(operation == CustomMessages.MessageType.EXAMPLE, "The message should contain a frozen state");
        CustomMessages.ExampleMessage memory message = CustomMessages.decodeExampleMessage(data);
        emit ExampleEvent(schainHash, message.number);
        return true;
    }

    constructor(
        string memory newSchainName,
        MessageProxyForSchain newMessageProxy,
        address newMainnetExample
    )
        public
    {
        schainHash = keccak256(abi.encodePacked(newSchainName));
        messageProxy = newMessageProxy;
        mainnetExample = newMainnetExample;
    }

}
