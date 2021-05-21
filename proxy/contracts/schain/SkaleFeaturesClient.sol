// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   SkaleFeaturesClient.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./SkaleFeatures.sol";


contract SkaleFeaturesClient is AccessControl {

    bytes32 public constant SKALE_FEATURES_SETTER_ROLE = keccak256("SKALE_FEATURES_SETTER_ROLE");

    address public skaleFeaturesAddress;

    modifier onlySkaleFeaturesSetter() {
        require(hasRole(SKALE_FEATURES_SETTER_ROLE, msg.sender), "SKALE_FEATURES_SETTER_ROLE is required");
        _;
    }

    function setSkaleFeaturesAddress(address newSkaleFeaturesAddress) external onlySkaleFeaturesSetter {
        skaleFeaturesAddress = newSkaleFeaturesAddress;
    }

    function getSkaleFeatures() public view returns (SkaleFeatures) {
        if (skaleFeaturesAddress != address(0)) {
            return SkaleFeatures(skaleFeaturesAddress);
        } else {
            return SkaleFeatures(0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2);
        }
    }
}