// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForMainnet.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@skalenetwork/skale-manager-interfaces/IWallets.sol";
import "@skalenetwork/skale-manager-interfaces/ISchains.sol";
import "@skalenetwork/ima-interfaces/mainnet/IMessageProxyForMainnet.sol";
import "@skalenetwork/ima-interfaces/mainnet/ICommunityPool.sol";

import "../MessageProxy.sol";
import "./SkaleManagerClient.sol";
import "./CommunityPool.sol";

interface IMessageProxyForMainnetInitializeFunction is IMessageProxyForMainnet {
    function initializeAllRegisteredContracts(
        bytes32 schainHash,
        address[] calldata contracts
    ) external;
}


/**
 * @title Message Proxy for Mainnet
 * @dev Runs on Mainnet, contains functions to manage the incoming messages from
 * `targetSchainName` and outgoing messages to `fromSchainName`. Every SKALE chain with 
 * IMA is therefore connected to MessageProxyForMainnet.
 *
 * Messages from SKALE chains are signed using BLS threshold signatures from the
 * nodes in the chain. Since Ethereum Mainnet has no BLS public key, mainnet
 * messages do not need to be signed.
 */
contract MessageProxyForMainnet is SkaleManagerClient, MessageProxy, IMessageProxyForMainnetInitializeFunction {

    using AddressUpgradeable for address;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /**
     * 16 Agents
     * Synchronize time with time.nist.gov
     * Every agent checks if it is their time slot
     * Time slots are in increments of 10 seconds
     * At the start of their slot each agent:
     * For each connected schain:
     * Read incoming counter on the dst chain
     * Read outgoing counter on the src chain
     * Calculate the difference outgoing - incoming
     * Call postIncomingMessages function passing (un)signed message array
     * ID of this schain, Chain 0 represents ETH mainnet,
    */

    ICommunityPool public communityPool;

    uint256 public headerMessageGasCost;
    uint256 public messageGasCost;
    mapping(bytes32 => EnumerableSetUpgradeable.AddressSet) private _registryContracts;
    string public version;
    bool public override messageInProgress;

    /**
     * @dev Emitted when gas cost for message header was changed.
     */
    event GasCostMessageHeaderWasChanged(
        uint256 oldValue,
        uint256 newValue
    );

    /**
     * @dev Emitted when gas cost for message was changed.
     */
    event GasCostMessageWasChanged(
        uint256 oldValue,
        uint256 newValue
    );

    modifier messageInProgressLocker() {
        require(!messageInProgress, "Message is in progress");
        messageInProgress = true;
        _;
        messageInProgress = false;
    }

    /**
     * @dev Allows DEFAULT_ADMIN_ROLE to initialize registered contracts
     * Notice - this function will be executed only once during upgrade
     * 
     * Requirements:
     * 
     * `msg.sender` should have DEFAULT_ADMIN_ROLE
     */
    function initializeAllRegisteredContracts(
        bytes32 schainHash,
        address[] calldata contracts
    ) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not authorized");
        for (uint256 i = 0; i < contracts.length; i++) {
            if (
                deprecatedRegistryContracts[schainHash][contracts[i]] &&
                !_registryContracts[schainHash].contains(contracts[i])
            ) {
                _registryContracts[schainHash].add(contracts[i]);
                delete deprecatedRegistryContracts[schainHash][contracts[i]];
            }
        }
    }

    /**
     * @dev Allows `msg.sender` to connect schain with MessageProxyOnMainnet for transferring messages.
     * 
     * Requirements:
     * 
     * - Schain name must not be `Mainnet`.
     */
    function addConnectedChain(string calldata schainName) external override {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(schainHash != MAINNET_HASH, "SKALE chain name is incorrect");
        _addConnectedChain(schainHash);
    }

    /**
     * @dev Allows owner of the contract to set CommunityPool address for gas reimbursement.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as DEFAULT_ADMIN_ROLE.
     * - Address of CommunityPool contract must not be null.
     */
    function setCommunityPool(ICommunityPool newCommunityPoolAddress) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        require(address(newCommunityPoolAddress) != address(0), "CommunityPool address has to be set");
        communityPool = newCommunityPoolAddress;
    }

    /**
     * @dev Allows `msg.sender` to register extra contract for being able to transfer messages from custom contracts.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as EXTRA_CONTRACT_REGISTRAR_ROLE.
     * - Schain name must not be `Mainnet`.
     */
    function registerExtraContract(string memory schainName, address extraContract) external override {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to register extra contract"
        );
        require(schainHash != MAINNET_HASH, "Schain hash can not be equal Mainnet");        
        _registerExtraContract(schainHash, extraContract);
    }

    /**
     * @dev Allows `msg.sender` to remove extra contract,
     * thus `extraContract` will no longer be available to transfer messages from mainnet to schain.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as EXTRA_CONTRACT_REGISTRAR_ROLE.
     * - Schain name must not be `Mainnet`.
     */
    function removeExtraContract(string memory schainName, address extraContract) external override {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to register extra contract"
        );
        require(schainHash != MAINNET_HASH, "Schain hash can not be equal Mainnet");
        _removeExtraContract(schainHash, extraContract);
    }

    /**
     * @dev Posts incoming message from `fromSchainName`. 
     * 
     * Requirements:
     * 
     * - `msg.sender` must be authorized caller.
     * - `fromSchainName` must be initialized.
     * - `startingCounter` must be equal to the chain's incoming message counter.
     * - If destination chain is Mainnet, message signature must be valid.
     */
    function postIncomingMessages(
        string calldata fromSchainName,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata sign
    )
        external
        override(IMessageProxy, MessageProxy)
        messageInProgressLocker
    {
        uint256 gasTotal = gasleft();
        bytes32 fromSchainHash = keccak256(abi.encodePacked(fromSchainName));
        require(_checkSchainBalance(fromSchainHash), "Schain wallet has not enough funds");
        require(connectedChains[fromSchainHash].inited, "Chain is not initialized");
        require(messages.length <= MESSAGES_LENGTH, "Too many messages");
        require(
            startingCounter == connectedChains[fromSchainHash].incomingMessageCounter,
            "Starting counter is not equal to incoming message counter");

        require(
            _verifyMessages(
                fromSchainName,
                _hashedArray(messages, startingCounter, fromSchainName),
                sign
            ),
            "Signature is not verified"
        );
        uint additionalGasPerMessage = 
            (gasTotal - gasleft() + headerMessageGasCost + messages.length * messageGasCost) / messages.length;
        uint notReimbursedGas = 0;
        for (uint256 i = 0; i < messages.length; i++) {
            gasTotal = gasleft();
            if (isContractRegistered(bytes32(0), messages[i].destinationContract)) {
                address receiver = _getGasPayer(fromSchainHash, messages[i], startingCounter + i);
                _callReceiverContract(fromSchainHash, messages[i], startingCounter + i);
                notReimbursedGas += communityPool.refundGasByUser(
                    fromSchainHash,
                    payable(msg.sender),
                    receiver,
                    gasTotal - gasleft() + additionalGasPerMessage
                );
            } else {
                _callReceiverContract(fromSchainHash, messages[i], startingCounter + i);
                notReimbursedGas += gasTotal - gasleft() + additionalGasPerMessage;
            }
        }
        connectedChains[fromSchainHash].incomingMessageCounter += messages.length;
        communityPool.refundGasBySchainWallet(fromSchainHash, payable(msg.sender), notReimbursedGas);
    }

    /**
     * @dev Sets headerMessageGasCost to a new value.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as CONSTANT_SETTER_ROLE.
     */
    function setNewHeaderMessageGasCost(uint256 newHeaderMessageGasCost) external override onlyConstantSetter {
        emit GasCostMessageHeaderWasChanged(headerMessageGasCost, newHeaderMessageGasCost);
        headerMessageGasCost = newHeaderMessageGasCost;
    }

    /**
     * @dev Sets messageGasCost to a new value.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as CONSTANT_SETTER_ROLE.
     */
    function setNewMessageGasCost(uint256 newMessageGasCost) external override onlyConstantSetter {
        emit GasCostMessageWasChanged(messageGasCost, newMessageGasCost);
        messageGasCost = newMessageGasCost;
    }

    /**
     * @dev Sets new version of contracts on mainnet
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted DEFAULT_ADMIN_ROLE.
     */
    function setVersion(string calldata newVersion) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DEFAULT_ADMIN_ROLE is required");
        emit VersionUpdated(version, newVersion);
        version = newVersion;
    }

    /**
     * @dev Creates a new MessageProxyForMainnet contract.
     */
    function initialize(IContractManager contractManagerOfSkaleManagerValue) public virtual override initializer {
        SkaleManagerClient.initialize(contractManagerOfSkaleManagerValue);
        MessageProxy.initializeMessageProxy(1e6);
        headerMessageGasCost = 70000;
        messageGasCost = 9000;
    }

    /**
     * @dev Checks whether chain is currently connected.
     * 
     * Note: Mainnet chain does not have a public key, and is implicitly 
     * connected to MessageProxy.
     * 
     * Requirements:
     * 
     * - `schainName` must not be Mainnet.
     */
    function isConnectedChain(
        string memory schainName
    )
        public
        view
        override(IMessageProxy, MessageProxy)
        returns (bool)
    {
        require(keccak256(abi.encodePacked(schainName)) != MAINNET_HASH, "Schain id can not be equal Mainnet");
        return super.isConnectedChain(schainName);
    }

    // private

    function _authorizeOutgoingMessageSender(bytes32 targetChainHash) internal view override {
        require(
            isContractRegistered(bytes32(0), msg.sender)
                || isContractRegistered(targetChainHash, msg.sender)
                || isSchainOwner(msg.sender, targetChainHash),
            "Sender contract is not registered"
        );        
    }

    /**
     * @dev Converts calldata structure to memory structure and checks
     * whether message BLS signature is valid.
     */
    function _verifyMessages(
        string calldata fromSchainName,
        bytes32 hashedMessages,
        MessageProxyForMainnet.Signature calldata sign
    )
        internal
        view
        returns (bool)
    {
        return ISchains(
            contractManagerOfSkaleManager.getContract("Schains")
        ).verifySchainSignature(
            sign.blsSignature[0],
            sign.blsSignature[1],
            hashedMessages,
            sign.counter,
            sign.hashA,
            sign.hashB,
            fromSchainName
        );
    }

    function _checkSchainBalance(bytes32 schainHash) internal view returns (bool) {
        return IWallets(
            contractManagerOfSkaleManager.getContract("Wallets")
        ).getSchainBalance(schainHash) >= (MESSAGES_LENGTH + 1) * gasLimit * tx.gasprice;
    }

    function _getRegistryContracts()
        internal
        view
        override
        returns (mapping(bytes32 => EnumerableSetUpgradeable.AddressSet) storage)
    {
        return _registryContracts;
    }
}
