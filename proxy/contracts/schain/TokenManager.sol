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

pragma solidity 0.8.6;

import "@skalenetwork/ima-interfaces/schain/ITokenManager.sol";
import "@skalenetwork/ima-interfaces/schain/ICommunityLocker.sol";

import "./MessageProxyForSchain.sol";
import "./TokenManagerLinker.sol";
import "./CommunityLocker.sol";


/**
 * @title TokenManager
 * @dev Base contract for all token managers.
 * 
 * Runs on SKALE Chains, accepts messages from mainnet, creates clones of tokens.
 * TokenManager mints tokens when user locks tokens on mainnet and burn them when user exits.
 */
abstract contract TokenManager is AccessControlEnumerableUpgradeable, ITokenManager {

    /**
     * @dev Mainnet identifier.
     */
    string constant public MAINNET_NAME = "Mainnet";

    /**
     * @dev Keccak256 hash of mainnet name.
     */
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));

    /**
     * @dev id of a role that allows turning on and turning off of automatic token clones deployment.
     */
    bytes32 public constant AUTOMATIC_DEPLOY_ROLE = keccak256("AUTOMATIC_DEPLOY_ROLE");

    /**
     * @dev id of a role that allows to register deployed token clone.
     */
    bytes32 public constant TOKEN_REGISTRAR_ROLE = keccak256("TOKEN_REGISTRAR_ROLE");
    
    /**
     * @dev Address of MessageProxyForSchain.
     */
    IMessageProxyForSchain public messageProxy;

    /**
     * @dev Address of TokenManagerLinker.
     */
    ITokenManagerLinker public tokenManagerLinker;

    /**
     * @dev Address of CommunityLocker.
     */
    ICommunityLocker public communityLocker;

    /**
     * @dev Keccak256 hash of schain name.
     */
    bytes32 public schainHash;

    /**
     * @dev Address of corresponding deposit box on mainnet.
     */
    address public depositBox;

    /**
     * @dev Show if automatic deploy of token clones are allowed.
     */
    bool public automaticDeploy;

    /**
     * @dev Addresses of corresponding token manager on other SKALE chains.
     */
    //   schainHash => TokenManager
    mapping(bytes32 => address) public tokenManagers;    

    /**
     * @dev Emitted when deposit box address was changed.
     */
    event DepositBoxWasChanged(
        address oldValue,
        address newValue
    );

    /**
     * @dev Modifier to make a function callable only if caller is granted with {AUTOMATIC_DEPLOY_ROLE}.
     */
    modifier onlyAutomaticDeploy() {
        require(hasRole(AUTOMATIC_DEPLOY_ROLE, msg.sender), "AUTOMATIC_DEPLOY_ROLE is required");
        _;
    }

    /**
     * @dev Modifier to make a function callable only if caller is granted with {TOKEN_REGISTRAR_ROLE}.
     */
    modifier onlyTokenRegistrar() {
        require(hasRole(TOKEN_REGISTRAR_ROLE, msg.sender), "TOKEN_REGISTRAR_ROLE is required");
        _;
    }

    /**
     * @dev Modifier to make a function callable only if caller is {MessageProxy}.
     */
    modifier onlyMessageProxy() {
        require(msg.sender == address(messageProxy), "Sender is not a MessageProxy");
        _;
    }

    /**
     * @dev Modifier to make a function callable only if
     * a message does not aim mainnet, target SKALE chain has token manager and receiver is set.
     */
    modifier rightTransaction(string memory targetSchainName, address to) {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        require(
            targetSchainHash != MAINNET_HASH,
            "This function is not for transferring to Mainnet"
        );
        require(to != address(0), "Incorrect receiver address");
        require(tokenManagers[targetSchainHash] != address(0), "Incorrect Token Manager address");
        _;
    }

    /**
     * @dev Modifier to make a function callable only if
     * sender is deposit box on mainnet or token manager on other SKALE chain.
     */
    modifier checkReceiverChain(bytes32 fromChainHash, address sender) {
        require(fromChainHash != schainHash && _checkSender(fromChainHash, sender), "Receiver chain is incorrect");
        _;
    }


    /**
     * @dev Turn on automatic deploy on schain.
     * 
     * Requirements:
     * 
     * - Function caller has to be granted with {AUTOMATIC_DEPLOY_ROLE}.
     */
    function enableAutomaticDeploy() external override onlyAutomaticDeploy {
        automaticDeploy = true;
    }

    /**
     * @dev Turn off automatic deploy on schain.
     * 
     * Requirements:
     * 
     * - Function caller has to be granted with {AUTOMATIC_DEPLOY_ROLE}.
     */
    function disableAutomaticDeploy() external onlyAutomaticDeploy {
        automaticDeploy = false;
    }

    /**
     * @dev Adds a TokenManager on SKALE chain to this TokenManager.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner or {TokenManagerLinker} contract.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addTokenManager(string calldata schainName, address newTokenManager) external override {
        require(
            msg.sender == address(tokenManagerLinker) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        bytes32 newSchainHash = keccak256(abi.encodePacked(schainName));
        require(tokenManagers[newSchainHash] == address(0), "Token Manager is already set");
        require(newTokenManager != address(0), "Incorrect Token Manager address");
        tokenManagers[newSchainHash] = newTokenManager;
    }

    /**
     * @dev Remove a TokenManager on SKALE chain from TokenManager.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner or {TokenManagerLinker} contract.
     * - SKALE chain must already be set.
     */
    function removeTokenManager(string calldata schainName) external override {
        require(
            msg.sender == address(tokenManagerLinker) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        bytes32 newSchainHash = keccak256(abi.encodePacked(schainName));
        require(tokenManagers[newSchainHash] != address(0), "Token Manager is not set");
        delete tokenManagers[newSchainHash];
    }

    /**
     * @dev Change Deposit Box address
     * This function should be executed only in emergency.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner.
     * - {newDepositBox} must be set.
     */
    function changeDepositBoxAddress(address newDepositBox) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DEFAULT_ADMIN_ROLE is required");
        require(newDepositBox != address(0), "DepositBox address has to be set");
        emit DepositBoxWasChanged(depositBox, newDepositBox);
        depositBox = newDepositBox;
    }

    /**
     * @dev Checks whether TokenManager is connected to a {schainName} SKALE chain TokenManager.
     */
    function hasTokenManager(string calldata schainName) external view override returns (bool) {
        return tokenManagers[keccak256(abi.encodePacked(schainName))] != address(0);
    }

    /**
     * @dev Is called once during contract deployment.
     */
    function initializeTokenManager(
        string memory newSchainName,
        IMessageProxyForSchain newMessageProxy,
        ITokenManagerLinker newIMALinker,
        ICommunityLocker newCommunityLocker,
        address newDepositBox
    )
        public
        virtual
        initializer
    {
        require(newDepositBox != address(0), "DepositBox address has to be set");

        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(AUTOMATIC_DEPLOY_ROLE, msg.sender);
        _setupRole(TOKEN_REGISTRAR_ROLE, msg.sender);

        schainHash = keccak256(abi.encodePacked(newSchainName));
        messageProxy = newMessageProxy;
        tokenManagerLinker = newIMALinker;
        communityLocker = newCommunityLocker;        
        depositBox = newDepositBox;

        emit DepositBoxWasChanged(address(0), newDepositBox);
    }

    /**
     * @dev Checks whether sender contract is DepositBox or TokenManager depending on chainHash.
     */
    function _checkSender(bytes32 fromChainHash, address sender) internal view virtual returns (bool) {
        return fromChainHash == MAINNET_HASH ? sender == depositBox : sender == tokenManagers[fromChainHash];
    }
}
