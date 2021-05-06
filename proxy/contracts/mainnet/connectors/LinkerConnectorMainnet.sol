// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   LinkerConnectorMainnet.sol - SKALE Interchain Messaging Agent
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


import "./ProxyConnectorMainnet.sol";


/**
 * @title LinkerConnectorMainnet - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract LinkerConnectorMainnet is ProxyConnectorMainnet {

    address public imaLinker;

    modifier onlyIMALinker() {
        require(msg.sender == imaLinker, "Sender is not a IMALInker");
        _;
    }

    /**
     * @dev initialize - sets current address of ContractManager of SkaleManager
     * @param newContractManagerOfSkaleManager - current address of ContractManager of SkaleManager
     */
    function initialize(
        address newContractManagerOfSkaleManager,
        address newMessageProxyAddress,
        address newIMALinkerAddress
    )
        public
        virtual
        initializer
    {
        ProxyConnectorMainnet.initialize(newContractManagerOfSkaleManager, newMessageProxyAddress);
        imaLinker = newIMALinkerAddress;
    }
}
