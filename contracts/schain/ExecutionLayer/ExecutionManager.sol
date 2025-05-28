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

import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IExecutionManager, SchainHash} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {ITokenManagerERC20} from "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerERC20.sol";
import {ExecutorId, IExecutor} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {IMessageProxy} from "@skalenetwork/ima-interfaces/IMessageProxy.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {ERC20OnChain, TokenManagerERC20} from "../TokenManagers/TokenManagerERC20.sol";
import {Protocol} from "./Protocol.sol";
import {ProtocolTypes, MetaActionId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ProtocolTypes.sol";
import {ITokenLocker} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ITokenLocker.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract ExecutionManager is ReentrancyGuardUpgradeable, AccessControlEnumerableUpgradeable, IExecutionManager {
    using AddressUpgradeable for address;
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Protocol for MetaActionId;
    using Protocol for ProtocolTypes.MetaAction;
    using Protocol for ProtocolTypes.TokenInfo;

    struct MetaActionContainer {
        uint96 version;
        uint256 seqNumber;
        address sender;
        SchainHash sourceChain;
        MetaActionId id;
        ProtocolTypes.MetaActionStatus status;
        ProtocolTypes.MetaAction metaAction;
    }

    uint256 public constant FAILSAFE_GAS = 200_000;
    uint256 public constant REVERT_REASON_LENGTH = 64;
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    TokenManagerERC20 public erc20TokenManager;
    ITokenLocker public tokenLocker;
    EnumerableMap.Bytes32ToAddressMap private _remoteExecutionManagers;
    EnumerableMap.Bytes32ToAddressMap private _executors;
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
        if (msg.sender != address(erc20TokenManager.messageProxy())) {
            revert SenderIsNotMessageProxy(msg.sender);
        }
        _;
    }

    function initialize(
        ITokenManagerERC20 erc20TokenManagerAddress,
        ITokenLocker locker
    ) external override initializer {
        __ReentrancyGuard_init();
        __AccessControlEnumerable_init();
        erc20TokenManager = TokenManagerERC20(address(erc20TokenManagerAddress));
        tokenLocker = locker;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function postMessage (
        SchainHash sourceChain,
        address sender,
        bytes calldata data
    ) external onlyMessageProxy nonReentrant override {
        if (!_remoteExecutionManagers.contains(SchainHash.unwrap(sourceChain))) {
            revert SourceChainIsNotRegistered(sourceChain);
        }
        if (address(_getRemoteExecutionManager(sourceChain)) != sender) {
            revert SenderIsNotExecutionManager(sourceChain, sender);
        }
        _processMessage(data, sourceChain);
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
        IExecutor executorAddress
    )
        external
        override
        onlyController
    {
        _executors.set(ExecutorId.unwrap(id), address(executorAddress));
    }

    function execute(
        ProtocolTypes.MetaAction calldata metaAction,
        ProtocolTypes.TokenInfo[] calldata tokens,
        ProtocolTypes.Action[] memory postActions
    )
        external
        override
        nonReentrant
    {
        _executeAndSendNextMetaAction(
            _createMetaAction(
                msg.sender,
                metaAction,
                tokens,
                postActions
            ),
            tokens
        );
    }

    // This works as a private function as the caller needs to be this
    // Does not make sense to expose in the interface
    // solhint-disable-next-line comprehensive-interface
    function processMetaActionConfirmation (
        MetaActionId id,
        ProtocolTypes.TokenInfo[] calldata tokens,
        SchainHash sourceSchain
    )
        external
    {
        require(msg.sender == address(this), "Sender must be self");
        tokenLocker.unlock(id);
        _processMetaActionConfirmation(metaActions[id], tokens, sourceSchain);
    }

    // This works as a private function as the caller needs to be this
    // Does not make sense to expose in the interface
    // solhint-disable-next-line comprehensive-interface
    function processMetaAction(MetaActionId id, ProtocolTypes.TokenInfo[] memory tokens) external {
        require(msg.sender == address(this), "Sender must be self");
        tokenLocker.unlock(id);
        _executeAndSendNextMetaAction(metaActions[id], tokens);
    }

    function getMetaActionStatus(
        MetaActionId id
    )
        external
        view
        override
        returns (ProtocolTypes.MetaActionStatus status)
    {
        return _getMetaAction(id).status;
    }

    function createSimpleMetaAction(
        SchainHash targetChain,
        ProtocolTypes.Action[] memory actions
    )
        external
        pure
        override
        returns (ProtocolTypes.MetaAction memory metaAction)
    {
        return ProtocolTypes.MetaAction({
            targetChainHash: targetChain,
            actions: Protocol.encodeActions(actions),
            nextMetaAction: "",
            postActions: "" // TODO
        });
    }

    function createChainedMetaAction(
        SchainHash targetChain,
        ProtocolTypes.Action[] memory actions,
        ProtocolTypes.MetaAction memory nextMetaAction,
        ProtocolTypes.Action[] memory postActions
    )
        external
        pure
        override
        returns (ProtocolTypes.MetaAction memory metaAction)
    {
        return ProtocolTypes.MetaAction({
            targetChainHash: targetChain,
            actions: Protocol.encodeActions(actions),
            nextMetaAction: Protocol.encodeMetaAction(nextMetaAction),
            postActions: Protocol.encodeActions(postActions)
        });
    }

    function getExecutor(
        ExecutorId id
    )
        public
        view
        override
        returns (IExecutor executor)
    {
        return IExecutor(_executors.get(ExecutorId.unwrap(id)));
    }

    function getMetaActionsWithLockedTokens()
        public
        view
        override
        returns (MetaActionId[] memory ids)
    {
        return tokenLocker.getMetaActionsWithLockedTokens();
    }

    function getTokenAddress(
        ProtocolTypes.TokenInfo memory tokenInfo
    )
        public
        pure
        override
        returns (address)
    {
        return tokenInfo.token;
    }

    // Private

    function _createMetaAction(
        address sender,
        ProtocolTypes.MetaAction memory metaAction,
        ProtocolTypes.TokenInfo[] memory tokens,
        ProtocolTypes.Action[] memory postActions
    )
        private
        returns (MetaActionContainer storage metaActionContainer)
    {
        MetaActionId id = _generateMetaActionId(sender);
        _validateMetaAction(metaAction);
        metaActions[id] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: sender,
            seqNumber: 0,
            sourceChain: SchainHash.wrap(bytes32(0)),
            id: id,
            status: ProtocolTypes.MetaActionStatus.EXECUTING,
            metaAction: ProtocolTypes.MetaAction({
                targetChainHash: SchainHash.wrap(bytes32(0)),
                actions: "",
                nextMetaAction: Protocol.encodeMetaAction(metaAction),
                postActions: Protocol.encodeActions(postActions)
            })
        });

        emit MetaActionCreated(id);

        _pullTokensFromSender(sender, tokens);

        return metaActions[id];
    }

    function _receiveMetaAction(
        ProtocolTypes.Message memory message,
        SchainHash sourceChain
    )
        private
    {
        ProtocolTypes.MetaAction memory metaAction;
        ProtocolTypes.TokenInfo[] memory tokens;
        (metaAction, tokens) = Protocol.decodeMetaActionMessage(message);

        metaActions[message.metaActionId] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: message.tokensOwner,
            seqNumber: message.seqNumber + 1,
            sourceChain: sourceChain,
            id: message.metaActionId,
            status: ProtocolTypes.MetaActionStatus.EXECUTING,
            metaAction: metaAction
        });

        // Agents should allways send messages with more than enough gas to lock tokens.
        bool locked = _lock(metaActions[message.metaActionId], _mapToThisSchainTokens(tokens, sourceChain));
        if(!locked){
            //TODO: try send failure with 0 tokens
            return;
        }

        (bool success, string memory err) = _tryCallProcessMetaAction(
            message.metaActionId,
            tokens
        );
        // MetaAction is either fully successfull or fully reverted after locking.

        if (success) return;

        emit MetaActionFailed(message.metaActionId, err);

        //TODO: try send failure with 0 tokens
    }

    function _tryCallProcessMetaAction(
        MetaActionId id,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
        returns (bool success, string memory error)
    {

        if (gasleft() < FAILSAFE_GAS) {
            // Dangerous zone
            return (false, "Not Enough Gas to Call processMetaAction");
        }
        try this.processMetaAction{gas: gasleft() - FAILSAFE_GAS}(
            id,
            tokens
        ) {
            return (true, "");
        } catch Error(string memory reason) {
            return (false, _getSlice(bytes(reason), REVERT_REASON_LENGTH));
        } catch Panic(uint errorCode) {
            return (false, string(abi.encodePacked(errorCode)));
        } catch (bytes memory revertData) {
            return (false, _getSlice(revertData, REVERT_REASON_LENGTH));
        }
    }

    function _receiveConfirmation(ProtocolTypes.Message memory message) private {
        SchainHash sourceSchain;
        ProtocolTypes.TokenInfo[] memory tokens;
        (sourceSchain, tokens) = Protocol.decodeConfirmationMessage(message);
        bool locked = _lock(metaActions[message.metaActionId], _mapToThisSchainTokens(tokens, sourceSchain));

        if(!locked){
            //TODO: try send failure with 0 tokens
            return;
        }

        (bool success, string memory err) = _tryCallProcessMetaActionConfirmation(
            message.metaActionId,
            tokens,
            sourceSchain
        );

        if (success) return;

        emit MetaActionConfirmationFailed(message.metaActionId, err);
        //TODO: try send failure with 0 tokens
    }

    function _tryCallProcessMetaActionConfirmation(
        MetaActionId id,
        ProtocolTypes.TokenInfo[] memory tokens,
        SchainHash sourceSchain
    )
        private
        returns (bool success, string memory error)
    {
        if (gasleft() < FAILSAFE_GAS) {
            // Dangerous zone
            return (false, "Not Enough Gas to Call processMetaActionConfirmation");
        }
        try this.processMetaActionConfirmation{gas: gasleft() - FAILSAFE_GAS}(
            id,
            tokens,
            sourceSchain
        ) {
            return (true, "");
        } catch Error(string memory reason) {
            return (false, _getSlice(bytes(reason), REVERT_REASON_LENGTH));
        } catch Panic(uint errorCode) {
            return (false, string(abi.encodePacked(errorCode)));
        } catch (bytes memory revertData) {
            return (false, _getSlice(revertData, REVERT_REASON_LENGTH));
        }
    }

    function _processMessage(bytes memory encodedMessage, SchainHash sourceChain) private {
        ProtocolTypes.Message memory message = Protocol.decodeMessage(encodedMessage);
        if (message.messageType == ProtocolTypes.MessageType.META_ACTION) {
            _receiveMetaAction(message, sourceChain);
        } else if (message.messageType == ProtocolTypes.MessageType.CONFIRMATION) {
            _receiveConfirmation(message);
        } else {
            revert Protocol.UnknownMessageType(message.messageType);
        }
    }



    function _processMetaActionConfirmation(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens,
        SchainHash sourceSchain
    )
        private
    {
        assert(metaAction.status == ProtocolTypes.MetaActionStatus.EXECUTING);

        ProtocolTypes.TokenInfo[] memory resultTokens = _postExecuteMetaAction(metaAction, tokens);
        metaAction.status = ProtocolTypes.MetaActionStatus.SUCCEED;

        resultTokens = _mapToThisSchainTokens(resultTokens, sourceSchain);

        if (_isOrigin(metaAction)) {
            for (uint256 i = 0; i < resultTokens.length; ++i) {
                IERC20 token = IERC20(resultTokens[i].token);
                require(token.transfer(metaAction.sender, resultTokens[i].value), "Token Transfer Failed");
            }
            return;
        }
        resultTokens = _sendBackTokens(metaAction.id, resultTokens);
        _sendConfirmation(metaAction, resultTokens);
    }

    function _executeAndSendNextMetaAction(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
    {
        assert(metaAction.status == ProtocolTypes.MetaActionStatus.EXECUTING);
        ProtocolTypes.TokenInfo[] memory tokensAfterActions = _executeActions(metaAction, tokens);
        _sendNextMetaAction(metaAction, tokensAfterActions);
    }

    function _sendBackTokens(
        MetaActionId id,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
        returns (ProtocolTypes.TokenInfo[] memory finalTokens)
    {

        MetaActionContainer storage metaAction = metaActions[id];

        assert(
            metaAction.status == ProtocolTypes.MetaActionStatus.FAILED ||
            metaAction.status == ProtocolTypes.MetaActionStatus.SUCCEED
        );

        // first metaAction should not send tokens anywhere
        assert(metaAction.seqNumber > 0);

        SchainHash sourceSchain = metaAction.sourceChain;
        address destination = address(_getRemoteExecutionManager(sourceSchain));
        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = IERC20(tokens[i].token);

            token.approve(address(erc20TokenManager), tokens[i].value);
            // Do I know destination address ?
            address dstAddress = erc20TokenManager.clonesErc20Inverted(sourceSchain, ERC20OnChain(tokens[i].token));
            if (dstAddress != address(0)) {
                tokens[i].token = dstAddress;
            }
            erc20TokenManager.transferToSchainHashERC20Direct(
                sourceSchain,
                tokens[i].token,
                tokens[i].value,
                destination
            );
        }
        finalTokens = tokens;
    }

    function _executeActions(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
        returns (ProtocolTypes.TokenInfo[] memory resultTokens)
    {
        ProtocolTypes.Action[] memory actions = Protocol.decodeActions(metaAction.metaAction.actions);
        return _executeParsedActions(actions, tokens, metaAction.sourceChain);
    }

    function _lock(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
        returns(bool success)
    {
        success = true;
        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = IERC20(tokens[i].token);
            if (token.balanceOf(address(this)) >= tokens[i].value) {
                token.approve(address(tokenLocker), tokens[i].value);
            }
            else {
                tokens[i].value = 0;
                success = false;
            }
        }
        tokenLocker.lock(tokens, metaAction.id, metaAction.sender);
    }

    function _postExecuteMetaAction(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
        returns (ProtocolTypes.TokenInfo[] memory resultTokens)
    {
        ProtocolTypes.Action[] memory actions = Protocol.decodeActions(metaAction.metaAction.postActions);
        return _executeParsedActions(actions, tokens, metaAction.sourceChain);
    }

    function _executeParsedActions(
        ProtocolTypes.Action[] memory actions,
        ProtocolTypes.TokenInfo[] memory tokens,
        SchainHash sourceChain
    )
        private
        returns (ProtocolTypes.TokenInfo[] memory resultTokens)
    {
        // executor may receive addresses of tokens in origin blockchain
        tokens = _mapToThisSchainTokens(tokens, sourceChain);

        for (uint256 i = 0; i < actions.length; ++i) {
            IExecutor executor = getExecutor(actions[i].executor);
            for (uint256 j = 0; j < tokens.length; ++j) {
                IERC20 token = IERC20(tokens[j].token);
                token.approve(address(executor), tokens[j].value);
            }
            // TODO: check gas limit guard (?)
            // We can leave it to the future for now
            tokens = executor.execute(tokens, actions[i].arguments);
        }
        resultTokens = tokens;
    }

    function _sendNextMetaAction(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
    {
        if (metaAction.metaAction.hasNextMetaAction()) {
            ProtocolTypes.MetaAction memory nextMetaAction;
            nextMetaAction = Protocol.decodeMetaAction(metaAction.metaAction.nextMetaAction);
            SchainHash targetChainHash = nextMetaAction.targetChainHash;
            address remoteExecutionManagerAddress = address(_getRemoteExecutionManager(targetChainHash));

            for (uint256 i = 0; i < tokens.length; ++i) {
                IERC20 token = IERC20(tokens[i].token);

                // Do I know the target token address?
                // If so, set it. Means I am likely in a chain that has a clone
                // And I am bridging back to my 'original' version
                address targetToken = erc20TokenManager.clonesErc20Inverted(
                    targetChainHash,
                    ERC20OnChain(tokens[i].token)
                );

                if (targetToken != address(0)) {
                    tokens[i].token = targetToken;
                }

                token.approve(address(erc20TokenManager), tokens[i].value);
                erc20TokenManager.transferToSchainHashERC20Direct(
                    targetChainHash,
                    tokens[i].token,
                    tokens[i].value,
                    remoteExecutionManagerAddress
                );
            }

            erc20TokenManager.messageProxy().postOutgoingMessage(
                targetChainHash,
                remoteExecutionManagerAddress,
                Protocol.encodeMetaActionMessage(
                    metaAction.id,
                    nextMetaAction,
                    tokens,
                    metaAction.sender,
                    metaAction.seqNumber
                )
            );
        } else {
            _processMetaActionConfirmation(metaAction, tokens, metaAction.sourceChain);
        }
    }

    function _sendConfirmation(
        MetaActionContainer storage metaAction,
        ProtocolTypes.TokenInfo[] memory tokens
    )
        private
    {
        SchainHash targetChainHash = metaAction.sourceChain;
        erc20TokenManager.messageProxy().postOutgoingMessage(
            targetChainHash,
            address(_getRemoteExecutionManager(targetChainHash)),
            Protocol.encodeConfirmationMessage(metaAction.id, erc20TokenManager.schainHash(), tokens)
        );
    }

    function _generateMetaActionId(address sender) private returns (MetaActionId) {
        // Why not Schain hash instead of chainid?
        return MetaActionId.wrap(keccak256(abi.encode(block.chainid, sender, nonces[sender]++)));
    }

    function _pullTokensFromSender(address sender, ProtocolTypes.TokenInfo[] memory tokens) private {
        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = IERC20(tokens[i].token);
            require(token.transferFrom(sender, address(this), tokens[i].value), "Token Transfer Failed");
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
        //TODO: verify initial action for loops
        return metaAction.seqNumber == 0;
    }

    function _mapToThisSchainTokens(
        ProtocolTypes.TokenInfo[] memory tokenInfo,
        SchainHash originSchain
    )
        private
        view
        returns (ProtocolTypes.TokenInfo[] memory updatedTokenInfo)
    {
        SchainHash thisSchain = erc20TokenManager.schainHash();
        if (thisSchain == originSchain) {
            // First message: If any token is invalid actions or transfers will
            // revert on bridging out or executing actions
            return tokenInfo;
        }
        updatedTokenInfo = new ProtocolTypes.TokenInfo[](tokenInfo.length);
        for (uint256 i = 0; i < tokenInfo.length; ++i) {
            address addressInThisSchain = address(erc20TokenManager.clonesErc20(originSchain, tokenInfo[i].token));
            if (addressInThisSchain == address(0)) {
                // I am probabily already the address on this chain
                // TODO: replace by check _schainToERC20[fromChainHash].contains(token) ?
                require(tokenInfo[i].token.isContract(), "This is not a valid token");
                addressInThisSchain = tokenInfo[i].token;
            }
            updatedTokenInfo[i] = ProtocolTypes.TokenInfo({
                token: addressInThisSchain,
                value: tokenInfo[i].value
            });
        }
        return updatedTokenInfo;
    }

    function _validateMetaAction(ProtocolTypes.MetaAction memory) private pure {
        //TODO: valididate ?
        // Maybe remove
        assert(true);
    }

    function _getSlice(bytes memory text, uint end) private pure returns (string memory) {
        uint slicedEnd = end < text.length ? end : text.length;
        bytes memory sliced = new bytes(slicedEnd);
        for(uint i = 0; i < slicedEnd; i++){
            sliced[i] = text[i];
        }
        return string(sliced);
    }
}
