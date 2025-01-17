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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IExecutionManager, SchainHash} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {ITokenManagerERC20} from "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerERC20.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {IMessageProxy} from "@skalenetwork/ima-interfaces/IMessageProxy.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {ERC20OnChain, TokenManagerERC20} from "../TokenManagers/TokenManagerERC20.sol";
import {MetaActionId, Protocol, TokenInfo} from "./Protocol.sol";
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

    TokenManagerERC20 public erc20TokenManager;
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
        if (msg.sender != address(erc20TokenManager.messageProxy())) {
            revert SenderIsNotMessageProxy(msg.sender);
        }
        _;
    }

    function initialize(ITokenManagerERC20 erc20TokenManagerAddress) external override initializer {
        erc20TokenManager = TokenManagerERC20(address(erc20TokenManagerAddress));
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
        erc20TokenManager.messageProxy().postOutgoingMessage(
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
        Protocol.MetaAction calldata metaAction,
        TokenInfo[] calldata tokens
    )
        external
    {
        _processMetaAction(
            _createMetaAction(
                msg.sender,
                metaAction,
                tokens
            ),
            tokens
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
            nextMetaAction: "",
            postActions: ""
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

    function getExecutor(ExecutorId id) public view returns (Executor executor) {
        return Executor(_executors.get(ExecutorId.unwrap(id)));
    }

    function getTokenAddress(TokenInfo memory tokenInfo) public view returns (address) {
        if(erc20TokenManager.addedClones(ERC20OnChain(tokenInfo.token))) {
            return tokenInfo.token;
        } else {
            return tokenInfo.origin;
        }
    }

    // Private

    function _createMetaAction(
        address sender,
        Protocol.MetaAction memory metaAction,
        TokenInfo[] memory tokens
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

        _pullTokensFromSender(sender, tokens);

        return metaActions[id];
    }

    function _receiveMetaAction(Protocol.Message memory message, SchainHash sourceChain) private {
        console.log("_receiveMetaAction");
        (Protocol.MetaAction memory metaAction, TokenInfo[] memory tokens) = Protocol.decodeMetaActionMessage(message);
        console.log("Number of tokens");
        console.log(tokens.length);
        metaActions[message.metaActionId] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: address(0),
            sourceChain: sourceChain,
            id: message.metaActionId,
            status: Protocol.MetaActionStatus.EXECUTING,
            metaAction: metaAction
        });
        _processMetaAction(metaActions[message.metaActionId], tokens);
    }

    function _receiveConfirmation(Protocol.Message memory message, SchainHash sourceChain) private {
        (Protocol.Confirmation memory confirmation, TokenInfo[] memory tokens) = Protocol.decodeConfirmationMessage(message);
        _processMetaActionConfirmation(metaActions[message.metaActionId], tokens);
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
            _receiveConfirmation(message, sourceChain);
        } else {
            revert Protocol.UnknownMessageType(message.messageType);
        }
    }

    function _processMetaAction(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
        console.log("_processMetaAction");
        TokenInfo[] memory tokensAfterActions = _executeActions(metaAction, tokens);
        _sendNextMetaAction(metaAction, tokensAfterActions);
    }

    function _processMetaActionConfirmation(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
        console.log("in _processMetaActionConfirmation");
        TokenInfo[] memory resultTokens = _postExecuteMetaAction(metaAction, tokens);
        metaAction.status = Protocol.MetaActionStatus.SUCCEED;
        console.log("Set status to ");
        console.log(uint(metaAction.status));
        if (!_isOrigin(metaAction)) {
            _sendConfirmation(metaAction, resultTokens);
        }
    }

    function _executeActions(
        MetaActionContainer storage metaAction,
        TokenInfo[] memory tokens
    )
        private
        returns (TokenInfo[] memory resultTokens)
    {
        console.log("_executeActions");
        Protocol.Action[] memory actions = Protocol.decodeActions(metaAction.metaAction.actions);
        return _executeParsedActions(actions, tokens);
    }

    function _postExecuteMetaAction(
        MetaActionContainer storage metaAction,
        TokenInfo[] memory tokens
    )
        private
        returns (TokenInfo[] memory resultTokens)
    {
        console.log("_postExecuteActions");
        Protocol.Action[] memory actions = Protocol.decodeActions(metaAction.metaAction.postActions);
        return _executeParsedActions(actions, tokens);
    }

    function _executeParsedActions(
        Protocol.Action[] memory actions,
        TokenInfo[] memory tokens
    )
        private
        returns (TokenInfo[] memory resultTokens)
    {
        console.log("_executeParsedActions");
        TokenInfo[] memory currentTokens = tokens;
        for (uint256 i = 0; i < actions.length; ++i) {
            Executor executor = getExecutor(actions[i].executor);
            for (uint256 j = 0; j < currentTokens.length; ++j) {
                IERC20 token = IERC20(getTokenAddress(currentTokens[j]));
                token.approve(address(executor), currentTokens[j].value);
            }
            // TODO: add gas limit guard
            currentTokens = executor.execute(currentTokens, actions[i].arguments);
        }
        resultTokens = currentTokens;
    }

    function _sendNextMetaAction(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
        console.log("_sendNextMetaAction");
        if (metaAction.metaAction.hasNextMetaAction()) {
            console.log("tokens length");
            console.log(tokens.length);
            Protocol.MetaAction memory nextMetaAction = Protocol.decodeMetaAction(metaAction.metaAction.nextMetaAction);
            SchainHash targetChainHash = nextMetaAction.targetChainHash;
            address remoteExecutionManagerAddress = address(_getRemoteExecutionManager(targetChainHash));

            for (uint256 i = 0; i < tokens.length; ++i) {
                console.log(address(erc20TokenManager));
                IERC20(tokens[i].token).approve(address(erc20TokenManager), tokens[i].value);
                erc20TokenManager.transferToSchainHashERC20Direct(
                    targetChainHash,
                    tokens[i].origin,
                    tokens[i].value,
                    remoteExecutionManagerAddress);
            }

            erc20TokenManager.messageProxy().postOutgoingMessage(
                targetChainHash,
                remoteExecutionManagerAddress,
                Protocol.encodeMetaActionMessage(metaAction.id, nextMetaAction, tokens)
            );
        } else {
            _processMetaActionConfirmation(metaAction, tokens);
        }
    }

    function _sendConfirmation(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
        SchainHash targetChainHash = metaAction.sourceChain;
        Protocol.Confirmation memory confirmation = Protocol.Confirmation({
            metaActionId: metaAction.id
        });
        erc20TokenManager.messageProxy().postOutgoingMessage(
            targetChainHash,
            address(_getRemoteExecutionManager(targetChainHash)),
            Protocol.encodeConfirmationMessage(metaAction.id, confirmation, tokens)
        );
    }

    function _generateMetaActionId(address sender) private returns (MetaActionId) {
        return MetaActionId.wrap(keccak256(abi.encode(block.chainid, sender, nonces[sender]++)));
    }

    function _pullTokensFromSender(address sender, TokenInfo[] memory tokens) private {
        uint256 tokensLength = tokens.length;
        for (uint256 i = 0; i < tokensLength; ++i) {
            IERC20 token = IERC20(tokens[i].token);
            token.transferFrom(sender, address(this), tokens[i].value);
        }
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
