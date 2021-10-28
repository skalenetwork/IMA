// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyCaller.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
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

pragma solidity 0.8.6;

import "../mainnet/MessageProxyForMainnet.sol";
import "../schain/MessageProxyForSchain.sol";


interface IMessageProxyCaller {
    function postOutgoingMessageTester(
        MessageProxyForMainnet messageProxyForMainnet,
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    ) external;
    function postOutgoingMessageTesterOnSchain(
        MessageProxyForSchain messageProxyForSchain,
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    ) external;
}


contract MessageProxyCaller is IMessageProxyCaller {    

    function postOutgoingMessageTester(
        MessageProxyForMainnet messageProxyForMainnet,
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    )
        external
        override
    {
        messageProxyForMainnet.postOutgoingMessage(targetChainHash, targetContract, data);
    }

    function postOutgoingMessageTesterOnSchain(
        MessageProxyForSchain messageProxyForSchain,
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    )
        external
        override
    {
        messageProxyForSchain.postOutgoingMessage(targetChainHash, targetContract, data);
    }
}