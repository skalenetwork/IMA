// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   OwnableForSchain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./SkaleFeatures.sol";


/**
 * @title OwnableForSchain
 * @dev The OwnableForSchain contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract OwnableForSchain is Ownable {

    using Address for address;
    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlySchainOwner() {
        require(msg.sender == getSchainOwner(), "Only schain owner can execute this method");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyLockAndDataOwner() {
        require(msg.sender == getLockAndDataOwner(), "Only lockAndData owner can execute this method");
        _;
    }

    /**
     * @dev The OwnableForSchain constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor() public Ownable() {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Returns owner address.
     */
    function getSchainOwner() public view returns (address) {
        if (owner() == (address(0)) )
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.ownerAddress"
            );
        return owner();
    }

    /**
     * @dev Returns owner address.
     */
    function getLockAndDataOwner() public view returns (address) {
        if (owner() == (address(0)) )
            return SkaleFeatures(
                    getSkaleFeaturesAddress()
                ).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.LockAndData"
            );
        return owner();
    }

    function getSkaleFeaturesAddress() public view returns (address) {
        return 0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2;
    }
}
