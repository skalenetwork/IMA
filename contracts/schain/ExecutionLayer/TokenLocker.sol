// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenLocker.sol - SKALE Interchain Messaging Agent
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

import {MetaActionId, Protocol, TokenInfo} from "./Protocol.sol";
import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IExecutionManager} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
pragma solidity 0.8.27;

contract TokenLocker is AccessControlEnumerableUpgradeable {

    using EnumerableSet for EnumerableSet.Bytes32Set;

    struct Lock {
        TokenInfo[] tokens;
        uint256 timestamp;
        MetaActionId  metaActionId;
        address tokensOwner;
        // Add mappings for different tokens
        mapping(IERC20 token => uint256 amount) balances;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EXECUTION_MANAGER_ROLE = keccak256("EXECUTION_MANAGER_ROLE");

    uint256 public constant LOCK_TIME = 20 minutes;

    mapping(MetaActionId metaAction => Lock lock) public lockData;
    IExecutionManager public executionManager;

    EnumerableSet.Bytes32Set private _metaActionsWithLockedTokens;

    event TokensUnlocked(MetaActionId indexed metaAction, address unlocker, TokenInfo[] tokens);
    event TokensLocked(MetaActionId indexed metaAction, address locker, TokenInfo[] tokens);


    function initialize() external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // modifiers

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert RoleRequired(DEFAULT_ADMIN_ROLE);
        }
        _;
    }

    modifier onlyExecutionManager() {
        if (!hasRole(EXECUTION_MANAGER_ROLE, msg.sender)) {
            revert RoleRequired(EXECUTION_MANAGER_ROLE);
        }
        _;
    }
    modifier allowedToUnlock(Lock storage lockInfo, address account){
        bool isOwner = account == lockInfo.tokensOwner;
        require(
            isOwner || hasRole(EXECUTION_MANAGER_ROLE, account),
            "Sender is not owner of tokens or is not Execution Manager."
        );
        if (isOwner) {
            // does he?
            require(
                block.timestamp > lockInfo.timestamp + LOCK_TIME,
                "User needs to wait for timeout to retrieve tokens."
            );
        }
        _;
    }
    modifier noLockForMetaAction(MetaActionId id) {
        require(
            !_metaActionsWithLockedTokens.contains(MetaActionId.unwrap(id)),
            "There are tokens locked for this metaAction"
        );
        _;
    }

    modifier lockForMetaActionExists(MetaActionId id) {
        require(
            _metaActionsWithLockedTokens.contains(MetaActionId.unwrap(id)),
            "There are no tokens locked for this metaAction"
        );
        _;
    }

    function getMetaActionsWithLockedTokens() public view returns (MetaActionId[] memory metaActions) {
        metaActions = new MetaActionId[](_metaActionsWithLockedTokens.length());
        for (uint256 i = 0; i < _metaActionsWithLockedTokens.length(); i++) {
            metaActions[i] = MetaActionId.wrap(_metaActionsWithLockedTokens.at(i));
        }
    }

    // external
    function lock(
        TokenInfo[] calldata tokens,
        MetaActionId metaAction,
        address owner
    )
        external
        onlyExecutionManager
        noLockForMetaAction(metaAction)
    {

        lockData[metaAction].timestamp = block.timestamp;
        lockData[metaAction].metaActionId = metaAction;
        lockData[metaAction].tokensOwner = owner;

        // Try to pull tokens
        for (uint256 i = 0; i < tokens.length; ++i) {

            //Add check for token type: different pull for each tokenType
            IERC20 token = IERC20(tokens[i].token);
            if (tokens[i].value == 0) {
                continue;
            }
            _pullERC20Token(token, tokens[i].value);
            lockData[metaAction].balances[token] = tokens[i].value;
            lockData[metaAction].tokens.push(tokens[i]);
        }
        assert(_metaActionsWithLockedTokens.add(MetaActionId.unwrap(metaAction)));

        emit TokensLocked(metaAction, msg.sender, tokens);
    }

    function unlock(
        MetaActionId metaAction
    )
        external
        lockForMetaActionExists(metaAction)
        allowedToUnlock(lockData[metaAction], msg.sender)
    {
        Lock storage lockInfo = lockData[metaAction];
        TokenInfo[] storage tokens = lockInfo.tokens;
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; ++i) {
            //Add check for token type: different pull for each tokenType
            IERC20 token = IERC20(tokens[tokens.length - 1].token);
            token.transfer(msg.sender, lockInfo.balances[token]);
            lockInfo.balances[token] = 0;
            tokens.pop();
        }
        assert(tokens.length == 0);
        lockInfo.timestamp = 0;
        assert(_metaActionsWithLockedTokens.remove(MetaActionId.unwrap(metaAction)));

        emit TokensUnlocked(metaAction, msg.sender, tokens);
    }


    // private
    function _pullERC20Token(IERC20 token, uint256 amount) private {
        token.transferFrom(msg.sender, address(this), amount);
    }
}

