// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   PermissionsForMainnet.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./interfaces/IContractManager.sol";
import "./interfaces/ISchainsInternal.sol";
import "./LockAndDataForMainnet.sol";


/**
 * @title PermissionsForMainnet - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract PermissionsForMainnet is AccessControlUpgradeable {

    // address of ContractManager
    address public lockAndDataAddress_;

    /**
     * @dev allow - throws if called by any account and contract other than the owner
     * or `contractName` contract
     * @param contractName - human readable name of contract
     */
    modifier allow(string memory contractName) {
        require(
            IContractManager(
                lockAndDataAddress_
            ).getContract(contractName) == msg.sender ||
            getOwner() == msg.sender, "Message sender is invalid"
        );
        _;
    }

    /**
     * @dev onlyOwner - throws if called by any account and contract other than the owner
     */
    modifier onlyOwner() {
        require(_isOwner(), "Caller is not the owner");
        _;
    }

    /**
     * @dev initialize - sets current address of ContractManager
     * @param newContractsAddress - current address of ContractManager
     */
    function initialize(address newContractsAddress) public virtual initializer {
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        lockAndDataAddress_ = newContractsAddress;
    }

    /**
     * @dev Returns LockAndDataForMainnet address
     */
    function getLockAndDataAddress() public view returns ( address a ) {
        return lockAndDataAddress_;
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
    function isSchainOwner(address sender, bytes32 schainId) public virtual view returns (bool) {
        return LockAndDataForMainnet(lockAndDataAddress_).isSchainOwner(sender, schainId);
    }

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function _isOwner() internal view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
