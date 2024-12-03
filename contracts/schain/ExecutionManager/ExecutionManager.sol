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

import {AccessControlEnumerableUpgradeable}
from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {IExecutionManager, SchainHash} from "@skalenetwork/ima-interfaces/schain/IExecutionManager.sol";
import {IMessageProxyForSchain} from "@skalenetwork/ima-interfaces/schain/IMessageProxyForSchain.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {MetaActionId, Protocol} from "./Protocol.sol";

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
    string public testMessage;
    mapping (address sender => uint256 nonce) public nonces;
    mapping (MetaActionId metaActionId => MetaActionContainer) public metaActions;

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
        if (!_remoteExecutionManagers.contains(SchainHash.unwrap(sourceChain))) {
            revert SourceChainIsNotRegistered(sourceChain);
        }
        if (address(_getRemoteExecutionManager(sourceChain)) != sender) {
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

    function execute(SchainHash targetChain) external {
        // TODO: create non empty meta action
        _processMetaAction(
            _createMetaAction(
                msg.sender,
                Protocol.MetaAction({
                    id: MetaActionId.wrap(0),
                    targetChainHash: targetChain,
                    actions: "",
                    nextMetaAction: "",
                    postActions: ""
                })
            )
        );
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
            metaAction: metaAction
        });
        return metaActions[id];
    }

    function _receiveMetaAction(bytes memory message, SchainHash sourceChain) private {
        Protocol.MetaAction memory metaAction = Protocol.decodeMetaAction(message);
        metaActions[metaAction.id] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: address(0),
            sourceChain: sourceChain,
            id: metaAction.id,
            status: Protocol.MetaActionStatus.EXECUTING,
            metaAction: metaAction
        });
        _processMetaAction(metaActions[metaAction.id]);
    }

    function _processMessage(bytes memory message, SchainHash sourceChain) private {
        Protocol.MessageType messageType = Protocol.getMessageType(message);
        if (messageType == Protocol.MessageType.META_ACTION) {
            _receiveMetaAction(message, sourceChain);
        } else {
            revert Protocol.UnknownMessageType(messageType);
        }
    }

    function _processMetaAction(MetaActionContainer storage metaAction) private {
        _executeActions(metaAction);
        _sendNextMetaAction(metaAction);
    }

    function _processMetaActionConfirmation(MetaActionContainer storage metaAction) private {
        _postExecuteMetaAction(metaAction);
        if (!_isOrigin(metaAction)) {
            _sendConfirmation(metaAction);
        }
    }

    function _executeActions(MetaActionContainer storage metaAction) private {

    }

    function _postExecuteMetaAction(MetaActionContainer storage metaAction) private {

    }

    function _sendNextMetaAction(MetaActionContainer storage metaAction) private {
        Protocol.MetaAction storage nextMetaAction = metaAction.metaAction.nextMetaAction;
        if (nextMetaAction.empty()) {
            _processMetaActionConfirmation(metaAction);
        } else {
            SchainHash targetChainHash = nextMetaAction.targetChainHash;
            messageProxy.postOutgoingMessage(
                targetChainHash,
                address(_getRemoteExecutionManager(targetChainHash)),
                Protocol.encodeMetaAction(nextMetaAction)
            );
        }
    }

    function _sendConfirmation(MetaActionContainer storage metaAction) private {
        SchainHash targetChainHash = metaAction.sourceChain;
        Protocol.Confirmation memory confirmation = Protocol.Conformation({
            id: metaAction.id
        });
        messageProxy.postOutgoingMessage(
            targetChainHash,
            address(_getRemoteExecutionManager(targetChainHash)),
            Protocol.encodeConfirmation(confirmation)
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
        if (!metaActions[id].id.isZero()) {
            revert MetaActionNotFound(id);
        }
        return metaActions[id];
    }

    function _isOrigin(MetaActionContainer storage metaAction) private view returns (bool result) {
        return metaAction.sender != address(0);
    }
}
