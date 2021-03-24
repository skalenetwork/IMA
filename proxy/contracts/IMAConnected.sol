// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IMAConnected.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.6.12;

import "./IMALinker.sol";
import "./MessageProxyForMainnet.sol";
import "./connectors/SchainOwnerConnector.sol";


/**
 * @title IMAConnected - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract IMAConnected is SchainOwnerConnector {

    IMALinker public imaLinker;
    MessageProxyForMainnet public messageProxy;

    modifier onlyMessageProxy() {
        require(msg.sender == address(messageProxy), "Sender is not a MessageProxy");
        _;
    }

    /**
     * @dev initialize - sets current address of ContractManager
     * @param newIMALinkerAddress - current address of ContractManager
     */
    function initialize(
        address newIMALinkerAddress,
        address newContractManagerOfSkaleManager,
        address newMessageProxyAddress
    )
        public
        virtual
        initializer
    {
        SchainOwnerConnector.initialize(newContractManagerOfSkaleManager);
        imaLinker = IMALinker(newIMALinkerAddress);
        messageProxy = MessageProxyForMainnet(newMessageProxyAddress);
    }
}
