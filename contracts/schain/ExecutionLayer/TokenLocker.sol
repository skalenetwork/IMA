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

pragma solidity 0.8.27;

import {Protocol} from "./Protocol.sol";
import {MetaActionId, ProtocolTypes} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ProtocolTypes.sol";
import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {RoleRequired} from "../../CommonErrors.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IExecutionManager} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenLocker} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ITokenLocker.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";


contract TokenLocker is AccessControlEnumerableUpgradeable, ReentrancyGuardUpgradeable, ITokenLocker {

    using EnumerableSet for EnumerableSet.Bytes32Set;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EXECUTION_MANAGER_ROLE = keccak256("EXECUTION_MANAGER_ROLE");

    // Probabily increase
    uint256 public constant LOCK_TIME = 20 minutes;

    mapping(MetaActionId metaAction => Lock lock) public lockData;

    EnumerableSet.Bytes32Set private _metaActionsWithLockedTokens;

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

    // external
    function initialize() external override initializer {
        __ReentrancyGuard_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function lock(
        ProtocolTypes.TokenInfo[] calldata tokens,
        MetaActionId metaAction,
        address owner
    )
        external
        override
        nonReentrant
        onlyExecutionManager
        noLockForMetaAction(metaAction)
    {

        lockData[metaAction].timestamp = block.timestamp;
        lockData[metaAction].metaActionId = metaAction;
        lockData[metaAction].tokensOwner = owner;
        assert(_metaActionsWithLockedTokens.add(MetaActionId.unwrap(metaAction)));

        // Update Data
        for (uint256 i = 0; i < tokens.length; ++i) {

            //TODO: Add check for token type: different pull for each tokenType
            IERC20 token = IERC20(tokens[i].token);
            if (tokens[i].value == 0) {
                continue;
            }
            lockData[metaAction].balances[token] += tokens[i].value;
            lockData[metaAction].tokens.push(tokens[i]);
        }
        emit TokensLocked(metaAction, msg.sender, tokens);
        // try to pull tokens
        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = IERC20(tokens[i].token);
            _pullERC20Token(token, tokens[i].value);
        }
    }

    function unlock(
        MetaActionId metaAction
    )
        external
        override
        nonReentrant
        lockForMetaActionExists(metaAction)
        allowedToUnlock(lockData[metaAction], msg.sender)
    {
        Lock storage lockInfo = lockData[metaAction];
        ProtocolTypes.TokenInfo[] memory tokens = lockInfo.tokens;
        uint256 length = tokens.length;
        lockInfo.timestamp = 0;
        assert(_metaActionsWithLockedTokens.remove(MetaActionId.unwrap(metaAction)));
        delete lockInfo.tokens;
        for (uint256 i = 0; i < length; ++i) {
            //Add check for token type
            IERC20 token = IERC20(tokens[i].token);
            tokens[i].value = lockInfo.balances[token];
            lockInfo.balances[token] = 0;
        }
        assert(lockInfo.tokens.length == 0);
        emit TokensUnlocked(metaAction, msg.sender, tokens);

        for (uint256 i = 0; i < length; ++i) {
            IERC20 token = IERC20(tokens[i].token);
            require(token.transfer(msg.sender, tokens[i].value), "Token Transfer Failed");
        }
    }

    function getMetaActionsWithLockedTokens()
        external
        view
        override
        returns (MetaActionId[] memory metaActions)
    {
        metaActions = new MetaActionId[](_metaActionsWithLockedTokens.length());
        for (uint256 i = 0; i < _metaActionsWithLockedTokens.length(); i++) {
            metaActions[i] = MetaActionId.wrap(_metaActionsWithLockedTokens.at(i));
        }
    }

    // private
    function _pullERC20Token(IERC20 token, uint256 amount) private {
        require(token.transferFrom(msg.sender, address(this), amount), "Token Transfer Failed");
    }
}

