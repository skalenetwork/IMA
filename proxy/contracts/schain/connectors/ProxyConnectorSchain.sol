// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ProxyConnectorSchain.sol - SKALE Interchain Messaging Agent
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


import "./SchainOwnerConnectorSchain.sol";

import "../../interfaces/IMessageProxy.sol";


/**
 * @title ProxyConnectorSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract ProxyConnectorSchain is SchainOwnerConnectorSchain {

    address public messageProxy;

    modifier onlyMessageProxy() {
        require(msg.sender == getProxyForSchainAddress(), "Sender is not a MessageProxy");
        _;
    }

    /**
     * @dev constructor - sets chainID
     */
    constructor(string memory chainID, address newMessageProxyAddress) public SchainOwnerConnectorSchain(chainID) {
        messageProxy = newMessageProxyAddress;
    }

    /**
     * @dev Returns MessageProxy address.
     */
    function getProxyForSchainAddress() public view returns (address) {
        if (messageProxy != address(0) )
            return messageProxy;
        return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
            "skaleConfig.contractSettings.IMA.MessageProxy"
        );
    }
}
