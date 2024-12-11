// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ExecutionManager.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2024-Present SKALE Labs
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

pragma solidity 0.8.27;

import "hardhat/console.sol";

import {AccessControlEnumerableUpgradeable}
from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {IExecutionManager, SchainHash} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {IMessageProxyForSchain} from "@skalenetwork/ima-interfaces/schain/IMessageProxyForSchain.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {MetaActionId, Protocol} from "./Protocol.sol";
import {Executor} from "./Executor.sol";

contract ExecutionManager is AccessControlEnumerableUpgradeable, IExecutionManager {
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using Protocol for MetaActionId;
    using Protocol for Protocol.MetaAction;

    struct MetaActionContainer {
        uint96 version;
        address sender;
        SchainHash sourceChain;
        MetaActionId id;
        Protocol.MetaActionStatus status;
        Protocol.MetaAction metaAction;
    }

    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    IMessageProxyForSchain public messageProxy;
    EnumerableMap.Bytes32ToAddressMap private _remoteExecutionManagers;
    EnumerableMap.Bytes32ToAddressMap private _executors;
    string public testMessage;
    mapping (address sender => uint256 nonce) public nonces;
    mapping (MetaActionId metaActionId => MetaActionContainer) public metaActions;

    event MetaActionCreated(
        MetaActionId id
    );

    error MetaActionNotFound(
        MetaActionId id
    );

    error SenderIsNotMessageProxy(
        address sender
    );

    error SourceChainIsNotRegistered(
        SchainHash chainHash
    );

    error SenderIsNotExecutionManager(
        SchainHash sourceChainHash,
        address sender
    );

    modifier onlyController() {
        if (!hasRole(CONTROLLER_ROLE, msg.sender)) {
            revert RoleRequired(CONTROLLER_ROLE);
        }
        _;
    }

    modifier onlyMessageProxy() {
        if (msg.sender != address(messageProxy)) {
            revert SenderIsNotMessageProxy(msg.sender);
        }
        _;
    }

    function initialize(IMessageProxyForSchain messageProxyAddress) external override initializer {
        messageProxy = messageProxyAddress;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function postMessage(
        SchainHash sourceChain,
        address sender,
        bytes calldata data
    ) external onlyMessageProxy override {
        console.log("Process incoming message");
        console.log(address(this));
        if (!_remoteExecutionManagers.contains(SchainHash.unwrap(sourceChain))) {
            console.log("SourceChainIsNotRegistered");
            revert SourceChainIsNotRegistered(sourceChain);
        }
        if (address(_getRemoteExecutionManager(sourceChain)) != sender) {
            console.log("SenderIsNotExecutionManager");
            revert SenderIsNotExecutionManager(sourceChain, sender);
        }
        _processMessage(data, sourceChain);
    }

    function testSend(SchainHash targetChainHash, string calldata message) external override {
        messageProxy.postOutgoingMessage(
            targetChainHash,
            address(_getRemoteExecutionManager(targetChainHash)),
            abi.encode(message)
        );
    }

    function setRemoteExecutionManager(
        SchainHash schainHash,
        address executionManagerAddress
    )
        external
        override
        onlyController
    {
        _remoteExecutionManagers.set(SchainHash.unwrap(schainHash), executionManagerAddress);
    }

    function setExecutor(
        ExecutorId id,
        Executor executorAddress
    )
        external
        onlyController
    {
        _executors.set(ExecutorId.unwrap(id), address(executorAddress));
    }

    function execute(
        Protocol.MetaAction calldata metaAction
    )
        external
    {
        _processMetaAction(
            _createMetaAction(
                msg.sender,
                metaAction
            )
        );
    }

    function getMetaActionStatus(MetaActionId id) external view returns (Protocol.MetaActionStatus status) {
        return _getMetaAction(id).status;
    }

    function createMetaAction(
        SchainHash targetChain,
        Protocol.Action[] memory actions
    )
        external
        pure
        returns (Protocol.MetaAction memory metaAction)
    {
        return Protocol.MetaAction({
            targetChainHash: targetChain,
            actions: Protocol.encodeActions(actions),
            nextMetaAction: "0x",
            postActions: "0x"
        });
    }

    function createMetaAction(
        SchainHash targetChain,
        Protocol.Action[] memory actions,
        bytes memory encodedNextMetaAction,
        Protocol.Action[] memory postActions
    )
        external
        pure
        returns (Protocol.MetaAction memory metaAction)
    {
        return Protocol.MetaAction({
            targetChainHash: targetChain,
            actions: Protocol.encodeActions(actions),
            nextMetaAction: encodedNextMetaAction,
            postActions: Protocol.encodeActions(postActions)
        });
    }

    function getExecutorAddress(ExecutorId id) external view returns (Executor executor) {
        return Executor(_executors.get(ExecutorId.unwrap(id)));
    }

    // Private

    function _createMetaAction(
        address sender,
        Protocol.MetaAction memory metaAction
    )
        private
        returns (MetaActionContainer storage metaActionContainer)
    {
        MetaActionId id = _generateMetaActionId(sender);
        metaActions[id] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: sender,
            sourceChain: SchainHash.wrap(bytes32(0)),
            id: id,
            status: Protocol.MetaActionStatus.EXECUTING,
            metaAction: Protocol.MetaAction({
                targetChainHash: SchainHash.wrap(bytes32(0)),
                actions: "",
                nextMetaAction: Protocol.encodeMetaAction(metaAction),
                postActions: ""
            })
        });

        emit MetaActionCreated(id);

        return metaActions[id];
    }

    function _receiveMetaAction(Protocol.Message memory message, SchainHash sourceChain) private {
        Protocol.MetaAction memory metaAction = Protocol.decodeMetaActionMessage(message);
        metaActions[message.metaActionId] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: address(0),
            sourceChain: sourceChain,
            id: message.metaActionId,
            status: Protocol.MetaActionStatus.EXECUTING,
            metaAction: metaAction
        });
        _processMetaAction(metaActions[message.metaActionId]);
    }

    function _processMessage(bytes memory encodedMessage, SchainHash sourceChain) private {
        console.log("Parse message type");
        Protocol.Message memory message = Protocol.decodeMessage(encodedMessage);
        console.log("MessageType:");
        console.log(uint(message.messageType));
        if (message.messageType == Protocol.MessageType.META_ACTION) {
            console.log("Process meta action");
            _receiveMetaAction(message, sourceChain);
        } else if (message.messageType == Protocol.MessageType.CONFIRMATION) {
            console.log("Process confirmation");
            _processMetaActionConfirmation(_getMetaAction(message.metaActionId));
        } else {
            revert Protocol.UnknownMessageType(message.messageType);
        }
    }

    function _processMetaAction(MetaActionContainer storage metaAction) private {
        _executeActions(metaAction);
        _sendNextMetaAction(metaAction);
    }

    function _processMetaActionConfirmation(MetaActionContainer storage metaAction) private {
        console.log("in _processMetaActionConfirmation");
        _postExecuteMetaAction(metaAction);
        metaAction.status = Protocol.MetaActionStatus.SUCCEED;
        console.log("Set status to ");
        console.log(uint(metaAction.status));
        if (!_isOrigin(metaAction)) {
            _sendConfirmation(metaAction);
        }
    }

    function _executeActions(MetaActionContainer storage metaAction) private {

    }

    function _postExecuteMetaAction(MetaActionContainer storage metaAction) private {

    }

    function _sendNextMetaAction(MetaActionContainer storage metaAction) private {
        if (metaAction.metaAction.hasNextMetaAction()) {
            Protocol.MetaAction memory nextMetaAction = Protocol.decodeMetaAction(metaAction.metaAction.nextMetaAction);
            SchainHash targetChainHash = nextMetaAction.targetChainHash;
            messageProxy.postOutgoingMessage(
                targetChainHash,
                address(_getRemoteExecutionManager(targetChainHash)),
                Protocol.encodeMetaActionMessage(metaAction.id, nextMetaAction)
            );
        } else {
            _processMetaActionConfirmation(metaAction);
        }
    }

    function _sendConfirmation(MetaActionContainer storage metaAction) private {
        SchainHash targetChainHash = metaAction.sourceChain;
        Protocol.Confirmation memory confirmation = Protocol.Confirmation({
            metaActionId: metaAction.id
        });
        messageProxy.postOutgoingMessage(
            targetChainHash,
            address(_getRemoteExecutionManager(targetChainHash)),
            Protocol.encodeConfirmationMessage(metaAction.id, confirmation)
        );
    }

    function _generateMetaActionId(address sender) private returns (MetaActionId) {
        return MetaActionId.wrap(keccak256(abi.encode(block.chainid, sender, nonces[sender]++)));
    }

    function _getRemoteExecutionManager(
        SchainHash schainHash
    )
        private
        view
        returns (ExecutionManager executionManager)
    {
        executionManager = ExecutionManager(_remoteExecutionManagers.get(SchainHash.unwrap(schainHash)));
    }

    function _getMetaAction(MetaActionId id) private view returns (MetaActionContainer storage metaAction) {
        if (metaActions[id].id.isZero()) {
            revert MetaActionNotFound(id);
        }
        return metaActions[id];
    }

    function _isOrigin(MetaActionContainer storage metaAction) private view returns (bool result) {
        return metaAction.sender != address(0);
    }
}
