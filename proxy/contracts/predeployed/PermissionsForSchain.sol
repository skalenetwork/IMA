// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   PermissionsForSchain.sol - SKALE Interchain Messaging Agent
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

import "./LockAndDataForSchain.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Address.sol";


/**
 * @title PermissionsForSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract PermissionsForSchain is Ownable {

    using Address for address;

    // address of ContractManager
    address public lockAndDataAddress;

    /**
     * @dev constructor - sets current address of ContractManager
     * @param newContractsAddress - current address of ContractManager
     */
    constructor(address newContractsAddress) public {
        lockAndDataAddress = newContractsAddress;
    }

    /**
     * @dev allow - throws if called by any account and contract other than the owner
     * or `contractName` contract
     * @param contractName - human readable name of contract
     */
    modifier allow(string memory contractName) {
        require(
            LockAndDataForSchain(getLockAndDataAddress()).getContract(contractName) == _msgSender() ||
            getAdmin() == _msgSender(),
            "Message sender is invalid"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the schain owner.
     */
    modifier onlySchainOwner() {
        require(
            isSchainOwner(_msgSender()) || _msgSender() == getAdmin(),
            "Only schain owner can execute this method"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the admin.
     */
    modifier onlyAdmin() {
        require(_msgSender() == getAdmin(), "Only admin can execute this method");
        _;
    }

    /**
     * @dev Returns true if sender is Schain owner
     */
    function isSchainOwner(address sender) public view returns (bool) {
        return LockAndDataForSchain(getLockAndDataAddress()).getSchainOwner() == sender;
    }

    /**
     * @dev Returns LockAndData address.
     */
    function getLockAndDataAddress() public view returns (address) {
        if (lockAndDataAddress == address(0))
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.LockAndData"
            );
        return lockAndDataAddress;
    }

    /**
     * @dev Returns admin address.
     */
    function getAdmin() public view returns (address) {
        if (owner() == address(0))
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.adminAddress"
            );
        return owner();
    }

    function getSkaleFeaturesAddress() public view returns (address) {
        return 0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2;
    }
}
