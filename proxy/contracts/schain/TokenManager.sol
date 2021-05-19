// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
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
pragma experimental ABIEncoderV2;

import "./MessageProxyForSchain.sol";
import "./SkaleFeaturesClient.sol";
import "./TokenManagerLinker.sol";


/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
abstract contract TokenManager is AccessControlUpgradeable {

    MessageProxyForSchain public messageProxy;
    TokenManagerLinker public tokenManagerLinker;
    bytes32 public schainId;
    address public depositBox;
    bool public automaticDeploy;

    mapping(bytes32 => address) public tokenManagers;

    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_ID = keccak256(abi.encodePacked(MAINNET_NAME));

    bytes32 public constant AUTOMATIC_DEPLOY_ROLE = keccak256("AUTOMATIC_DEPLOY_ROLE");
    bytes32 public constant TOKEN_REGISTRAR_ROLE = keccak256("TOKEN_REGISTRAR_ROLE");

    modifier onlyAutomaticDeploy() {
        require(hasRole(AUTOMATIC_DEPLOY_ROLE, msg.sender), "AUTOMATIC_DEPLOY_ROLE is required");
        _;
    }

    modifier onlyTokenRegistrar() {
        require(hasRole(TOKEN_REGISTRAR_ROLE, msg.sender), "TOKEN_REGISTRAR_ROLE is required");
        _;
    }

    constructor(
        string memory newSchainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        address newDepositBox
    )
        public
    {
        require(newDepositBox.isContract(), "Given address is not a contract");

        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(AUTOMATIC_DEPLOY_ROLE, msg.sender);
        _setupRole(TOKEN_REGISTRAR_ROLE, msg.sender);

        schainId = keccak256(abi.encodePacked(newSchainName));
        messageProxy = newMessageProxy;
        tokenManagerLinker = newIMALinker;        
        depositBox = newDepositBox;
    }

    function postMessage(
        string calldata fromSchainID,
        address sender,
        bytes calldata data
    )
        external
        virtual
        returns (bool);

    /**
     * @dev Allows Schain owner turn on automatic deploy on schain.
     */
    function enableAutomaticDeploy() external onlyAutomaticDeploy {
        automaticDeploy = true;
    }

    /**
     * @dev Allows Schain owner turn off automatic deploy on schain.
     */
    function disableAutomaticDeploy() external onlyAutomaticDeploy {
        automaticDeploy = false;
    }

    /**
     * @dev Adds a TokenManagerEth address to
     * depositBox.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addTokenManager(string calldata schainName, address newTokenManager) external {
        require(
            msg.sender == address(tokenManagerLinker) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(tokenManagers[schainHash] == address(0), "Token Manager is already set");
        require(newTokenManager != address(0), "Incorrect Token Manager address");
        tokenManagers[schainHash] = newTokenManager;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerEth on SKALE chain
     * from depositBox.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeTokenManager(string calldata schainName) external {
        require(
            msg.sender == address(tokenManagerLinker) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(tokenManagers[schainHash] != address(0), "Token Manager is not set");
        delete tokenManagers[schainHash];
    }

    /**
     * @dev Checks whether TokenManager is connected to a {schainName} SKALE chain TokenManager.
     */
    function hasTokenManager(string calldata schainName) external view returns (bool) {
        return tokenManagers[keccak256(abi.encodePacked(schainName))] != address(0);
    }
}