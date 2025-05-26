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

import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IExecutionManager, SchainHash} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {ITokenManagerERC20} from "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerERC20.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {IMessageProxy} from "@skalenetwork/ima-interfaces/IMessageProxy.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {ERC20OnChain, TokenManagerERC20} from "../TokenManagers/TokenManagerERC20.sol";
import {MetaActionId, Protocol, TokenInfo} from "./Protocol.sol";
import {Executor} from "./Executor.sol";
import {TokenLocker} from "./TokenLocker.sol";

contract ExecutionManager is AccessControlEnumerableUpgradeable, IExecutionManager {
    using AddressUpgradeable for address;
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Protocol for MetaActionId;
    using Protocol for Protocol.MetaAction;

    struct MetaActionContainer {
        uint96 version;
        uint256 seqNumber;
        address sender;
        SchainHash sourceChain;
        MetaActionId id;
        Protocol.MetaActionStatus status;
        Protocol.MetaAction metaAction;
    }

    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    TokenManagerERC20 public erc20TokenManager;
    TokenLocker public tokenLocker;
    EnumerableMap.Bytes32ToAddressMap private _remoteExecutionManagers;
    EnumerableMap.Bytes32ToAddressMap private _executors;
    mapping (address sender => uint256 nonce) public nonces;
    mapping (MetaActionId metaActionId => MetaActionContainer) public metaActions;

    event MetaActionCreated(
        MetaActionId id
    );

    event MetaActionFailed(
        MetaActionId indexed id,
        string reason
    );

    event MetaActionConfirmationFailed(
        MetaActionId indexed id,
        string reason
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

    function initialize(ITokenManagerERC20 erc20TokenManagerAddress, address locker) external override initializer {
        erc20TokenManager = TokenManagerERC20(address(erc20TokenManagerAddress));
        tokenLocker = TokenLocker(locker);
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
        TokenInfo[] calldata tokens,
        Protocol.Action[] memory postActions
    )
        external
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
            postActions: "" // TODO
        });
    }

    function createMetaAction(
        SchainHash targetChain,
        Protocol.Action[] memory actions,
        Protocol.MetaAction memory nextMetaAction,
        Protocol.Action[] memory postActions
    )
        external
        pure
        returns (Protocol.MetaAction memory metaAction)
    {
        return Protocol.MetaAction({
            targetChainHash: targetChain,
            actions: Protocol.encodeActions(actions),
            nextMetaAction: Protocol.encodeMetaAction(nextMetaAction),
            postActions: Protocol.encodeActions(postActions)
        });
    }

    function getExecutor(ExecutorId id) public view returns (Executor executor) {
        return Executor(_executors.get(ExecutorId.unwrap(id)));
    }

    function getTokenAddress(TokenInfo memory tokenInfo) public view override returns (address) {
        return tokenInfo.token;
    }

    function getMetaActionsWithLockedTokens() public view returns (MetaActionId[] memory ids) {
        return tokenLocker.getMetaActionsWithLockedTokens();
    }
    function processMetaActionConfirmation (MetaActionId id, TokenInfo[] calldata tokens, SchainHash sourceSchain) external {
        require(msg.sender == address(this), "Sender must be self");
        tokenLocker.unlock(id);
        console.log("locked tokens for confirmation");
        _processMetaActionConfirmation(metaActions[id], tokens, sourceSchain);
    }

    function processMetaAction(MetaActionId id, TokenInfo[] memory tokens) external {
        require(msg.sender == address(this), "Sender must be self");
        tokenLocker.unlock(id);
        _executeAndSendNextMetaAction(metaActions[id], tokens);
    }

    // Private
    function _validateMetaAction(Protocol.MetaAction memory metaAction) private {
        //TODO: valididate circles? Highly inneficient.
        // the idea is to not use storage...Doing it only off-chain is enough maybe??
    }

    function _createMetaAction(
        address sender,
        Protocol.MetaAction memory metaAction,
        TokenInfo[] memory tokens,
        Protocol.Action[] memory postActions
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
            status: Protocol.MetaActionStatus.EXECUTING,
            metaAction: Protocol.MetaAction({
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

    function _receiveMetaAction(Protocol.Message memory message, SchainHash sourceChain) private {
        (Protocol.MetaAction memory metaAction, TokenInfo[] memory tokens) = Protocol.decodeMetaActionMessage(message);
        metaActions[message.metaActionId] = MetaActionContainer({
            version: Protocol.VERSION,
            sender: message.tokensOwner,
            seqNumber: message.seqNumber + 1,
            sourceChain: sourceChain,
            id: message.metaActionId,
            status: Protocol.MetaActionStatus.EXECUTING,
            metaAction: metaAction
        });

        // Agents should allways send messages with more than enough gas to lock tokens.
        bool locked = _lock(metaActions[message.metaActionId], _mapToThisSchainTokens(tokens, sourceChain));

        // Should be more then enough to send failure with 0 tokens
        uint256 failsafeGas = 200000;
        if (gasleft() < failsafeGas) {
            // Dangerous zone
            return;
        }
        if(!locked){
            //TODO: send failure with 0 tokens
            return;
        }
        // MetaAction is either fully successfull or fully reverted after locking.
        (bool success, bytes memory result) = address(this).call{gas: gasleft() - failsafeGas}(
            abi.encodeWithSelector(this.processMetaAction.selector, message.metaActionId, tokens)
        );
        if (success){
            return;
        }
        if(result.length > 67){
            assembly {
                result := add(result, 0x04) // skip the function selector
            }
            emit MetaActionFailed(message.metaActionId, abi.decode(result, (string)));
        }
        console.log(abi.decode(result, (string)));
        //TODO: send failure with 0 tokens
    }

    function _receiveConfirmation(Protocol.Message memory message) private {
        (SchainHash sourceSchain, TokenInfo[] memory tokens) = Protocol.decodeConfirmationMessage(message);
        console.log("going to lock N tokens:", tokens.length);
        bool locked = _lock(metaActions[message.metaActionId], _mapToThisSchainTokens(tokens, sourceSchain));

        // Should be more then enough to send failure with 0 tokens
        uint256 failsafeGas = 200000;
        if (gasleft() < failsafeGas) {
            // Dangerous zone
            return;
        }
        if(!locked){
            //TODO: send failure with 0 tokens
            return;
        }

        // MetaActionConfirmation and post actions are either fully successfull or fully reverted.
        (bool success, bytes memory result) = address(this).call{gas: gasleft() - failsafeGas}(
            abi.encodeWithSelector(this.processMetaActionConfirmation.selector, message.metaActionId, tokens, sourceSchain)
        );
        if (success){
            console.log("Success");
            return;
        }
        if(result.length > 67){
            assembly {
                result := add(result, 0x04) // skip the function selector
            }
            emit MetaActionConfirmationFailed(message.metaActionId, abi.decode(result, (string)));
        }
        console.log(abi.decode(result, (string)));

        //TODO: send failure with 0 tokens
    }

    function _processMessage(bytes memory encodedMessage, SchainHash sourceChain) private {
        Protocol.Message memory message = Protocol.decodeMessage(encodedMessage);
        console.log("received message");
        if (message.messageType == Protocol.MessageType.META_ACTION) {
            _receiveMetaAction(message, sourceChain);
        } else if (message.messageType == Protocol.MessageType.CONFIRMATION) {
            _receiveConfirmation(message);
        } else {
            revert Protocol.UnknownMessageType(message.messageType);
        }
    }



    function _processMetaActionConfirmation(MetaActionContainer storage metaAction, TokenInfo[] memory tokens, SchainHash sourceSchain) private {
        assert(metaAction.status == Protocol.MetaActionStatus.EXECUTING);

        TokenInfo[] memory resultTokens = _postExecuteMetaAction(metaAction, tokens);
        metaAction.status = Protocol.MetaActionStatus.SUCCEED;

        resultTokens = _mapToThisSchainTokens(resultTokens, sourceSchain);

        if (_isOrigin(metaAction)) {
            console.log("Sending tokens to user");
            for (uint256 i = 0; i < resultTokens.length; ++i) {
                IERC20 token = IERC20(resultTokens[i].token);
                token.transfer(metaAction.sender, resultTokens[i].value);
            }
            return;
        }
        console.log("Sending back:", resultTokens.length, "tokens");
        resultTokens = _sendBackTokens(metaAction.id, resultTokens);
        console.log("Sent back:", resultTokens.length, "tokens");
        _sendConfirmation(metaAction, resultTokens);
    }

    function _executeAndSendNextMetaAction(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
        assert(metaAction.status == Protocol.MetaActionStatus.EXECUTING);
        TokenInfo[] memory tokensAfterActions = _executeActions(metaAction, tokens);
        _sendNextMetaAction(metaAction, tokensAfterActions);
    }

    function _sendBackTokens(MetaActionId id, TokenInfo[] memory tokens) private returns (TokenInfo[] memory finalTokens) {

        MetaActionContainer storage metaAction = metaActions[id];

        assert(
            metaAction.status == Protocol.MetaActionStatus.FAILED ||
            metaAction.status == Protocol.MetaActionStatus.SUCCEED
        );

        // first metaAction should not send tokens anywhere
        assert(metaAction.seqNumber > 0);

        SchainHash sourceSchain = metaAction.sourceChain;
        address destination = address(_getRemoteExecutionManager(sourceSchain));
        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = IERC20(tokens[i].token);
            console.log(tokens[i].token, token.balanceOf(address(this)), tokens[i].value);

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
        TokenInfo[] memory tokens
    )
        private
        returns (TokenInfo[] memory resultTokens)
    {
        Protocol.Action[] memory actions = Protocol.decodeActions(metaAction.metaAction.actions);
        return _executeParsedActions(actions, tokens, metaAction.sourceChain);
    }

    function _lock(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private returns(bool success) {
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
        TokenInfo[] memory tokens
    )
        private
        returns (TokenInfo[] memory resultTokens)
    {
        Protocol.Action[] memory actions = Protocol.decodeActions(metaAction.metaAction.postActions);
        return _executeParsedActions(actions, tokens, metaAction.sourceChain);
    }

    function _executeParsedActions(
        Protocol.Action[] memory actions,
        TokenInfo[] memory tokens,
        SchainHash sourceChain
    )
        private
        returns (TokenInfo[] memory resultTokens)
    {
        // executor may receive addresses of tokens in origin blockchain
        // it needs to first ask tokenManager the correct addresses in this chain (or/and confirm the received are valid)
        // these tokens have previously been bridged here or from here, so addresses should be known
        tokens = _mapToThisSchainTokens(tokens, sourceChain);

        for (uint256 i = 0; i < actions.length; ++i) {
            Executor executor = getExecutor(actions[i].executor);
            for (uint256 j = 0; j < tokens.length; ++j) {
                IERC20 token = IERC20(tokens[j].token);
                token.approve(address(executor), tokens[j].value);
            }
            // TODO: check gas limit guard
            // I think for now we can simplify with the previous gas guard, and if eventualy it runs out of gas during execution
            // All actions will be reverted if execution runs out of gas and tokens will be locked.
            // Handling execute by execute gas seems extra complexity for no reward other than maximize gas usage.
            // And there's no guarantee it's safe to only execute some actions.
            tokens = executor.execute(tokens, actions[i].arguments);
        }
        resultTokens = tokens;
    }

    function _sendNextMetaAction(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
        if (metaAction.metaAction.hasNextMetaAction()) {
            Protocol.MetaAction memory nextMetaAction = Protocol.decodeMetaAction(metaAction.metaAction.nextMetaAction);
            SchainHash targetChainHash = nextMetaAction.targetChainHash;
            address remoteExecutionManagerAddress = address(_getRemoteExecutionManager(targetChainHash));

            for (uint256 i = 0; i < tokens.length; ++i) {
                IERC20 token = IERC20(tokens[i].token);

                // Do I know the target token address?
                // If so, set it. Means I am likely in a chain that has a clone
                // And I am bridging back to my 'original' version
                address targetToken = erc20TokenManager.clonesErc20Inverted(targetChainHash, ERC20OnChain(tokens[i].token));
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
                Protocol.encodeMetaActionMessage(metaAction.id, nextMetaAction, tokens, metaAction.sender, metaAction.seqNumber)
            );
        } else {
            console.log("Sending confirmation");
            _processMetaActionConfirmation(metaAction, tokens, metaAction.sourceChain);
            console.log("Sent Succsessfuly");
        }
    }

    function _sendConfirmation(MetaActionContainer storage metaAction, TokenInfo[] memory tokens) private {
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

    function _pullTokensFromSender(address sender, TokenInfo[] memory tokens) private {
        for (uint256 i = 0; i < tokens.length; ++i) {
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
        //TODO: verify initial action for loops
        return metaAction.seqNumber == 0;
    }

    function _mapToThisSchainTokens(TokenInfo[] memory tokenInfo, SchainHash originSchain) private view returns (TokenInfo[] memory updatedTokenInfo) {
        SchainHash thisSchain = erc20TokenManager.schainHash();
        if (thisSchain == originSchain) {
            // First message: If any token is invalid actions or transfers will
            // revert on bridging out or executing actions
            return tokenInfo;
        }
        updatedTokenInfo = new TokenInfo[](tokenInfo.length);
        for (uint256 i = 0; i < tokenInfo.length; ++i) {
            address addressInThisSchain = address(erc20TokenManager.clonesErc20(originSchain, tokenInfo[i].token));
            if (addressInThisSchain == address(0)) {
                // I am probabily already the address on this chain
                // TODO: replace by check _schainToERC20[fromChainHash].contains(token) ?
                require(tokenInfo[i].token.isContract(), "This is not a valid token");
                addressInThisSchain = tokenInfo[i].token;
            }
            updatedTokenInfo[i] = TokenInfo({
                token: addressInThisSchain,
                value: tokenInfo[i].value
            });
        }
        return updatedTokenInfo;
    }
}
