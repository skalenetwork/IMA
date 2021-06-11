// SPDX-License-Identifier: AGPL-3.0-only

/*
    CommunityPool.sol - SKALE Manager
    Copyright (C) 2021-Present SKALE Labs
    @author Dmytro Stebaiev
    @author Artem Payvin
    @author Vadim Yavorsky

    SKALE Manager is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SKALE Manager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with SKALE Manager.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../Messages.sol";
import "./MessageProxyForMainnet.sol";
import "../interfaces/IMainnetContract.sol";
import "./Linker.sol";

/**
 * @title CommunityPool
 * @dev Contract contains logic to perform automatic self-recharging ether for nodes
 */
contract CommunityPool is Twin {

    mapping(address => mapping(bytes32 => uint)) private _userWallets;
    mapping(address => bool) public activeUsers;

    uint public minTransactionGas;
    bytes32 public constant CONSTANT_SETTER_ROLE = keccak256("CONSTANT_SETTER_ROLE");

    function refundGasByUser(
        bytes32 schainHash,
        address payable node,
        address user,
        uint gas
    ) 
        external
        onlyMessageProxy
    {
        require(activeUsers[user], "User should be active");
        uint amount = tx.gasprice * gas;
        _userWallets[user][schainHash] = _userWallets[user][schainHash].sub(amount);
        if (_userWallets[user][schainHash] < minTransactionGas * tx.gasprice) {
            activeUsers[user] = false;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeLockUserMessage(user)
            );
        }
        node.transfer(amount);
    }

    function rechargeUserWallet(string calldata schainName) external payable {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            msg.value.add(_userWallets[msg.sender][schainHash]) >=
                minTransactionGas * tx.gasprice,
            "Not enough money for transaction"
        );
        _userWallets[msg.sender][schainHash] = _userWallets[msg.sender][schainHash].add(msg.value);
        if (!activeUsers[msg.sender]) {
            activeUsers[msg.sender] = true;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeActivateUserMessage(msg.sender)
            );
        }
    }

    function withdrawFunds(string calldata schainName, uint amount) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(amount <= _userWallets[msg.sender][schainHash], "Balance is too low");
        _userWallets[msg.sender][schainHash] = _userWallets[msg.sender][schainHash].sub(amount);
        if (
            _userWallets[msg.sender][schainHash] < minTransactionGas * tx.gasprice &&
            activeUsers[msg.sender]
        ) {
            activeUsers[msg.sender] = false;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeLockUserMessage(msg.sender)
            );
        }
        msg.sender.transfer(amount);
    }

    function setMinTransactionGas(uint newMinTransactionGas) external {
        require(hasRole(CONSTANT_SETTER_ROLE, msg.sender), "CONSTANT_SETTER_ROLE is required");
        minTransactionGas = newMinTransactionGas;
    }

    function getBalance(string calldata schainName) external view returns (uint) {
        return _userWallets[msg.sender][keccak256(abi.encodePacked(schainName))];
    }

    function initialize(
        IContractManager contractManagerOfSkaleManager,
        Linker linker,
        MessageProxyForMainnet messageProxy
    )
        public
        initializer
    {
        Twin.initialize(contractManagerOfSkaleManager, messageProxy);
        _setupRole(LINKER_ROLE, address(linker));
        minTransactionGas = 1000000;
    }
}
