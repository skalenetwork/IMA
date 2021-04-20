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
import "./OwnableForSchain.sol";


/**
 * @title PermissionsForSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract PermissionsForSchain is OwnableForSchain {

    // address of ContractManager
    address public lockAndDataAddress_;

    /**
     * @dev constructor - sets current address of ContractManager
     * @param newContractsAddress - current address of ContractManager
     */
    constructor(address newContractsAddress) public {
        lockAndDataAddress_ = newContractsAddress;
    }

    /**
     * @dev allow - throws if called by any account and contract other than the owner
     * or `contractName` contract
     * @param contractName - human readable name of contract
     */
    modifier allow(string memory contractName) {
        require(
            LockAndDataForSchain(
                getLockAndDataAddress()
            ).getContract(contractName) == msg.sender ||
            getSchainOwner() == msg.sender, "Message sender is invalid"
        );
        _;
    }

    function isSchainOwner(address sender) public virtual view returns (bool) {
        return LockAndDataForSchain(getLockAndDataAddress()).isSchainOwner(sender);
    }

    function getLockAndDataAddress() public view returns ( address a ) {
        if (lockAndDataAddress_ != address(0) )
            return lockAndDataAddress_;
        return SkaleFeatures(getSkaleFeaturesAddress()).
            getConfigVariableAddress("skaleConfig.contractSettings.IMA.LockAndData");
    }

}
