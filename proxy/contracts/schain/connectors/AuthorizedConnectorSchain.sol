// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   AuthorizedConnectorSchain.sol - SKALE Interchain Messaging Agent
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
 * @title AuthorizedConnectorSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract AuthorizedConnectorSchain is BasicConnectorSchain {

    mapping(address => bool) private _authorizedCaller;

    /**
     * @dev constructtor - sets chainID
     */
    constructor(string memory chainID) public BasicConnectorSchain(chainID) {
        _authorizedCaller[msg.sender] = true;
    }

    function addAuthorizedCaller(address caller) external onlyOwner {
        _authorizedCaller[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external onlyOwner {
        _authorizedCaller[caller] = false;
    }

    /**
     * @dev Checks whether sender is node address from the SKALE chain
     */
    function isAuthorizedCaller(bytes32 , address sender) public view returns (bool) {
        if (_authorizedCaller[sender] )
            return true;
        if (isCustomDeploymentMode)
            return false;
        uint256 flag = SkaleFeatures(getSkaleFeaturesAddress()).getConfigPermissionFlag(
            sender, "skaleConfig.contractSettings.IMA.variables.MessageProxy.mapAuthorizedCallers"
        );
        if (flag != 0)
            return true;
        return false;
    }
}
