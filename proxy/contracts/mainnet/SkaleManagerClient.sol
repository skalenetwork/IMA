// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   SkaleManagerClient.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@skalenetwork/skale-manager-interfaces/IContractManager.sol";
import "@skalenetwork/skale-manager-interfaces/ISchainsInternal.sol";
import "hardhat/console.sol";

/**
 * @title SkaleManagerClient - contract that knows ContractManager
 * and makes calls to SkaleManager contracts
 * @author Artem Payvin
 * @author Dmytro Stebaiev
 */
contract SkaleManagerClient is Initializable, AccessControlUpgradeable {
    using SafeMathUpgradeable for uint256;

    IContractManager public contractManagerOfSkaleManager;

    modifier onlySchainOwner(string memory schainName) {
        require(
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))),
            "Sender is not an Schain owner"
        );
        _;
    }

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function isSchainOwner(address sender, bytes32 schainHash) public view returns (bool) {
        address skaleChainsInternal = contractManagerOfSkaleManager.getContract("SchainsInternal");
        return ISchainsInternal(skaleChainsInternal).isOwnerAddress(sender, schainHash);
    }

    /**
     * @dev initialize - sets current address of ContractManager of SkaleManager
     * @param newContractManagerOfSkaleManager - current address of ContractManager of SkaleManager
     */
    function initialize(
        IContractManager newContractManagerOfSkaleManager
    )
        public
        virtual
        initializer
    {
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        contractManagerOfSkaleManager = newContractManagerOfSkaleManager;
    }
}
