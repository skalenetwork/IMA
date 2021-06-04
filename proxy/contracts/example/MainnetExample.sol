// SPDX-License-Identifier: AGPL-3.0-only

/*
    CommunityPool.sol - SKALE Manager
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
import "../mainnet/MessageProxyForMainnet.sol";


contract MainnetExample {

    MessageProxyForMainnet public messageProxy;

    function sendToSchain(
        string calldata schainName,
        address contractReceiverOnSchain
    ) 
        external
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiverOnSchain,
            CustomMessages.encodeExampleMessage(1)
        );
    }

    constructor(MessageProxyForMainnet newMessageProxy) public {
        messageProxy = newMessageProxy;
    }
}
