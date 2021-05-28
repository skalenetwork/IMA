// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForMainnetTester.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../mainnet/MessageProxyForMainnet.sol";
import "../schain/MessageProxyForSchain.sol";

contract MessageProxyForMainnetTester {    

    function postOutgoingMessageTester(
        MessageProxyForMainnet messageProxyForMainnet,
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    )
        external
    {
        messageProxyForMainnet.postOutgoingMessage(targetChainHash, targetContract, data);
    }

    function postOutgoingMessageTester2(
        MessageProxyForSchain messageProxyForSchain,
        string memory targetChainName,
        address targetContract,
        bytes calldata data
    )
        external
    {
        messageProxyForSchain.postOutgoingMessage(targetChainName, targetContract, data);
    }

    // function initialize2(IContractManager newContractManagerOfSkaleManager) public  {
    //     MessageProxyForMainnet.initialize(newContractManagerOfSkaleManager);
    // }
    
    // constructor(IContractManager newContractManagerOfSkaleManager) public  {
    //     MessageProxyForMainnet.initialize(newContractManagerOfSkaleManager);
    // }
}