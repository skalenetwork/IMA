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
contract CommunityPool is SkaleManagerClient {

    MessageProxyForMainnet public messageProxy;

    mapping(address => mapping(bytes32 => uint)) private _userWallets;
    mapping(address => bool) public activeUsers;
    mapping(bytes32 => address) public schainLinks;

    uint public minTransactionGas;
    bytes32 public constant LINKER_ROLE = keccak256("LINKER_ROLE");

    function refundGasByUser(
        bytes32 schainHash,
        address payable node,
        address user,
        uint gas
    ) 
        external
    {
        require(msg.sender == address(messageProxy),  "Sender is not a MessageProxy");
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

    function addSchainContract(string calldata schainName, address contractOnSchain) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(LINKER_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash), "Not authorized caller"
        );
        require(schainLinks[schainHash] == address(0), "SKALE chain is already set");
        require(contractOnSchain != address(0), "Incorrect address for contract on Schain");
        schainLinks[schainHash] = contractOnSchain;
    }

    function removeSchainContract(string calldata schainName) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(LINKER_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash), "Not authorized caller"
        );
        require(schainLinks[schainHash] != address(0), "SKALE chain is not set");
        delete schainLinks[schainHash];
    }

    function hasSchainContract(string calldata schainName) external view returns (bool) {
        return schainLinks[keccak256(abi.encodePacked(schainName))] != address(0);
    }

    function getBalance(string calldata schainName) external view returns (uint) {
        return _userWallets[msg.sender][keccak256(abi.encodePacked(schainName))];
    }

    function initialize(
        IContractManager contractManagerOfSkaleManager,
        Linker linker,
        MessageProxyForMainnet newMessageProxy
    )
        public
        initializer
    {
        SkaleManagerClient.initialize(contractManagerOfSkaleManager);
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(LINKER_ROLE, address(linker));
        messageProxy = newMessageProxy;
        minTransactionGas = 1000000;
    }
}
