// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   BasicConnector.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "../../interfaces/IContractManager.sol";


/**
 * @title BasicConnector - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract BasicConnector is AccessControlUpgradeable {
    using SafeMathUpgradeable for uint256;

    address public contractManagerOfSkaleManager;

    modifier onlyOwner() {
        require(_isOwner(), "Sender is not the owner");
        _;
    }

    /**
     * @dev initialize - sets current address of ContractManager of SkaleManager
     * @param newContractManagerOfSkaleManager - current address of ContractManager of SkaleManager
     */
    function initialize(
        address newContractManagerOfSkaleManager
    )
        public
        virtual
        initializer
    {
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        contractManagerOfSkaleManager = newContractManagerOfSkaleManager;
    }

    /**
     * @dev Returns owner address.
     */
    function getOwner() public view returns ( address ow ) {
        return getRoleMember(DEFAULT_ADMIN_ROLE, 0);
    }

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function _isOwner() internal view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
