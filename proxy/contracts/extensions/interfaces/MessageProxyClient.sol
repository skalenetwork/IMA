// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyClient.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Artem Payvin
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

import "../../MessageProxy.sol";

abstract contract MessageProxyClient {
    MessageProxy public messageProxy;

    modifier onlyMessageProxy() {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        _;
    }

    constructor(address newMessageProxyAddress) {
        messageProxy = MessageProxy(newMessageProxyAddress);
    }
}