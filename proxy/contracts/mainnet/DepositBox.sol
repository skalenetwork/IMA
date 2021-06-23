// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBox.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Artem Payvin
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

pragma solidity 0.8.4;

import "./Linker.sol";
import "./MessageProxyForMainnet.sol";


/**
 * @title ProxyConnectorMainnet - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
abstract contract DepositBox is Twin {

    Linker public linker;

    mapping(bytes32 => bool) public withoutWhitelist;

    bytes32 public constant DEPOSIT_BOX_MANAGER_ROLE = keccak256("DEPOSIT_BOX_MANAGER_ROLE");

    modifier whenNotKilled(bytes32 schainHash) {
        require(linker.isNotKilled(schainHash), "Schain is killed");
        _;
    }

    modifier whenKilled(bytes32 schainHash) {
        require(!linker.isNotKilled(schainHash), "Schain is not killed");
        _;
    }

    modifier rightTransaction(string memory schainName, address to) {
        require(
            keccak256(abi.encodePacked(schainName)) != keccak256(abi.encodePacked("Mainnet")),
            "SKALE chain name cannot be Mainnet"
        );
        require(to != address(0), "Receiver address cannot be null");
        _;
    }

    modifier checkReceiverChain(bytes32 schainHash, address sender) {
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == schainLinks[schainHash],
            "Receiver chain is incorrect"
        );
        _;
    }

    /**
     * @dev Allows Schain owner turn on whitelist of tokens.
     */
    function enableWhitelist(string memory schainName) external onlySchainOwner(schainName) {
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = false;
    }

    /**
     * @dev Allows Schain owner turn off whitelist of tokens.
     */
    function disableWhitelist(string memory schainName) external onlySchainOwner(schainName) {
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = true;
    }

    function initialize(
        IContractManager contractManagerOfSkaleManager,
        Linker newLinker,
        MessageProxyForMainnet messageProxy
    )
        public
        virtual
        initializer
    {
        Twin.initialize(contractManagerOfSkaleManager, messageProxy);
        _setupRole(LINKER_ROLE, address(newLinker));
        linker = newLinker;
    }
}
