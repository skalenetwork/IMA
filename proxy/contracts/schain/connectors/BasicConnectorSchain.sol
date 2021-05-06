// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   BasicConnectorSchain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../SkaleFeatures.sol";

/**
 * @title BasicConnectorSchain - connected module for Upgradeable approach, knows chainID
 * @author Artem Payvin
 */
contract BasicConnectorSchain is AccessControl {
    using SafeMath for uint256;

    string private _chainID;

    bool public isCustomDeploymentMode;

    address public skaleFeaturesAddress;

    modifier onlyOwner() {
        require(_isOwner(), "Sender is not the owner");
        _;
    }

    /**
     * @dev construcor - sets chainID
     */
    constructor(string memory chainID) public {
        _chainID = chainID;
        isCustomDeploymentMode = true;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setSkaleFeaturesAddress(address newSkaleFeaturesAddress) external onlyOwner {
        skaleFeaturesAddress = newSkaleFeaturesAddress;
    }

    /**
     * @dev Returns owner address.
     */
    function getOwner() public view returns ( address ow ) {
        return getRoleMember(DEFAULT_ADMIN_ROLE, 0);
    }

    /**
     * @dev Returns chain ID.
     */
    function getChainID() public view returns (string memory) {
        if (!isCustomDeploymentMode) {
            if ((keccak256(abi.encodePacked(_chainID))) == (keccak256(abi.encodePacked(""))) )
                return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableString(
                    "skaleConfig.sChain.schainName"
                );
        }
        return _chainID;
    }

    function getSkaleFeaturesAddress() public view returns (address) {
        if (skaleFeaturesAddress != address(0)) {
            return skaleFeaturesAddress;
        } else {
            return 0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2;
        }
    }

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function _isOwner() internal view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
