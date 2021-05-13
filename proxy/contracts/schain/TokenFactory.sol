// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenFactory.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
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

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./SkaleFeaturesClient.sol";


contract TokenFactory is SkaleFeaturesClient {

    address public tokenManagerAddress;
    string public tokenManagerName;

    modifier onlyTokenManager() {
        require(getTokenManager() == msg.sender, "Sender is not TokenManager");
        _;
    }

    constructor(string memory newTokenManagerName, address newTokenManagerAddress) public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        tokenManagerName = newTokenManagerName;
        tokenManagerAddress = newTokenManagerAddress;
    }

    function getTokenManager() public view returns (address) {
        if (tokenManagerAddress == address(0)) {
            return getSkaleFeatures().getConfigVariableAddress(
                string(abi.encodePacked("skaleConfig.contractSettings.IMA", tokenManagerName))
            );
        }
        return tokenManagerAddress;
    }
}