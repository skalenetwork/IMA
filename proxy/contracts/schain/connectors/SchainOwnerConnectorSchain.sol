// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   SchainOwnerConnectorSchain.sol - SKALE Interchain Messaging Agent
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

import "./BasicConnectorSchain.sol";


/**
 * @title SchainOwnerConnectorSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract SchainOwnerConnectorSchain is BasicConnectorSchain {

    modifier onlySchainOwner() {
        require(msg.sender == getSchainOwner(), "Only schain owner can execute this method");
        _;
    }

    /**
     * @dev constructor - sets chainID
     */
    constructor(string memory chainID) public BasicConnectorSchain(chainID)
    {
        
    }

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function isSchainOwner(address sender) public view returns (bool) {
        return sender == getSchainOwner();
    }

    /**
     * @dev Returns owner address.
     */
    function getSchainOwner() public view returns (address) {
        if (getOwner() == (address(0)) )
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.ownerAddress"
            );
        return getOwner();
    }
}
