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

import "../MessageProxy.sol";
import "./SkaleManagerClient.sol";
import "./CommunityPool.sol";


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
contract MessageProxyForMainnet is SkaleManagerClient, MessageProxy {

    using AddressUpgradeable for address;

    /**
     * 16 Agents
     * Synchronize time with time.nist.gov
     * Every agent checks if it is his time slot
     * Time slots are in increments of 10 seconds
     * At the start of his slot each agent:
     * For each connected schain:
     * Read incoming counter on the dst chain
     * Read outgoing counter on the src chain
     * Calculate the difference outgoing - incoming
     * Call postIncomingMessages function passing (un)signed message array
     * ID of this schain, Chain 0 represents ETH mainnet,
    */

    CommunityPool public communityPool;

    uint256 public headerMessageGasCost;
    uint256 public messageGasCost;

    event GasCostMessageHeaderWasChanged(
        uint256 oldValue,
        uint256 newValue
    );

    event GasCostMessageWasChanged(
        uint256 oldValue,
        uint256 newValue
    );

    /**
     * @dev Allows LockAndData to add a `schainName`.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be SKALE Node address.
     * - `schainName` must not be "Mainnet".
     * - `schainName` must not already be added.
     */
    function addConnectedChain(string calldata schainName) external override {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(schainHash != MAINNET_HASH, "SKALE chain name is incorrect");
        _addConnectedChain(schainHash);
    }

    function setCommunityPool(CommunityPool newCommunityPoolAddress) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        require(address(newCommunityPoolAddress) != address(0), "CommunityPool address has to be set");
        communityPool = newCommunityPoolAddress;
    }

    function registerExtraContract(string memory schainName, address extraContract) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to register extra contract"
        );
        require(schainHash != MAINNET_HASH, "Schain hash can not be equal Mainnet");        
        _registerExtraContract(schainHash, extraContract);
    }

    function removeExtraContract(string memory schainName, address extraContract) external {
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
        override
    {
        uint256 gasTotal = gasleft();
        bytes32 fromSchainHash = keccak256(abi.encodePacked(fromSchainName));
        require(_checkSchainBalance(fromSchainHash), "Schain wallet has not enough funds");
        require(connectedChains[fromSchainHash].inited, "Chain is not initialized");
        require(messages.length <= MESSAGES_LENGTH, "Too many messages");
        require(
            startingCounter == connectedChains[fromSchainHash].incomingMessageCounter,
            "Starting counter is not equal to incoming message counter");

        require(_verifyMessages(fromSchainName, _hashedArray(messages), sign), "Signature is not verified");
        uint additionalGasPerMessage = 
            (gasTotal - gasleft() + headerMessageGasCost + messages.length * messageGasCost) / messages.length;
        uint notReimbursedGas = 0;
        for (uint256 i = 0; i < messages.length; i++) {
            gasTotal = gasleft();
            if (registryContracts[bytes32(0)][messages[i].destinationContract]) {
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
     * @dev Sets headerMessageGasCost to a new value
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as CONSTANT_SETTER_ROLE.
     */
    function setNewHeaderMessageGasCost(uint256 newHeaderMessageGasCost) external onlyConstantSetter {
        emit GasCostMessageHeaderWasChanged(headerMessageGasCost, newHeaderMessageGasCost);
        headerMessageGasCost = newHeaderMessageGasCost;
    }

    /**
     * @dev Sets messageGasCost to a new value
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as CONSTANT_SETTER_ROLE.
     */
    function setNewMessageGasCost(uint256 newMessageGasCost) external onlyConstantSetter {
        emit GasCostMessageWasChanged(messageGasCost, newMessageGasCost);
        messageGasCost = newMessageGasCost;
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
        override
        returns (bool)
    {
        require(keccak256(abi.encodePacked(schainName)) != MAINNET_HASH, "Schain id can not be equal Mainnet");
        return super.isConnectedChain(schainName);
    }

    // Create a new message proxy

    function initialize(IContractManager contractManagerOfSkaleManagerValue) public virtual override initializer {
        SkaleManagerClient.initialize(contractManagerOfSkaleManagerValue);
        MessageProxy.initializeMessageProxy(1e6);
        headerMessageGasCost = 70000;
        messageGasCost = 8790;
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
}
