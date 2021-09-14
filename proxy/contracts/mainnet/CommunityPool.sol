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

pragma solidity 0.8.6;

import "../Messages.sol";
import "./MessageProxyForMainnet.sol";
import "./Linker.sol";

/**
 * @title CommunityPool
 * @dev Contract contains logic to perform automatic self-recharging ether for nodes
 */
contract CommunityPool is Twin {

    using AddressUpgradeable for address payable;

    bytes32 public constant CONSTANT_SETTER_ROLE = keccak256("CONSTANT_SETTER_ROLE");

    mapping(address => mapping(bytes32 => uint)) private _userWallets;
    mapping(address => mapping(bytes32 => bool)) public activeUsers;

    uint public minTransactionGas;    

    event MinTransactionGasWasChanged(
        uint oldValue,
        uint newValue
    );

    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,
        Linker linker,
        MessageProxyForMainnet messageProxyValue
    )
        external
        initializer
    {
        Twin.initialize(contractManagerOfSkaleManagerValue, messageProxyValue);
        _setupRole(LINKER_ROLE, address(linker));
        minTransactionGas = 1e6;
    }

    function refundGasByUser(
        bytes32 schainHash,
        address payable node,
        address user,
        uint gas
    ) 
        external
        onlyMessageProxy
    {
        require(activeUsers[user][schainHash], "User should be active");
        require(node != address(0), "Node address must be set");
        uint amount = tx.gasprice * gas;
        _userWallets[user][schainHash] = _userWallets[user][schainHash] - amount;
        if (_userWallets[user][schainHash] < minTransactionGas * tx.gasprice) {
            activeUsers[user][schainHash] = false;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeLockUserMessage(user)
            );
        }
        node.sendValue(amount);
    }

    /**
     * @dev Allows `msg.sender` to recharge their wallet for further gas reimbursement.
     * 
     * Requirements:
     * 
     * - 'msg.sender` should recharge their gas wallet for amount that enough to reimburse any 
     *   transaction from schain to mainnet.
     */
    function rechargeUserWallet(string calldata schainName, address user) external payable {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            msg.value + _userWallets[user][schainHash] >= minTransactionGas * tx.gasprice,
            "Not enough ETH for transaction"
        );
        _userWallets[user][schainHash] = _userWallets[user][schainHash] + msg.value;
        if (!activeUsers[user][schainHash]) {
            activeUsers[user][schainHash] = true;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeActivateUserMessage(user)
            );
        }
    }

    function withdrawFunds(string calldata schainName, uint amount) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(amount <= _userWallets[msg.sender][schainHash], "Balance is too low");
        _userWallets[msg.sender][schainHash] = _userWallets[msg.sender][schainHash] - amount;
        if (
            _userWallets[msg.sender][schainHash] < minTransactionGas * tx.gasprice &&
            activeUsers[msg.sender][schainHash]
        ) {
            activeUsers[msg.sender][schainHash] = false;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeLockUserMessage(msg.sender)
            );
        }
        payable(msg.sender).sendValue(amount);
    }

    function setMinTransactionGas(uint newMinTransactionGas) external {
        require(hasRole(CONSTANT_SETTER_ROLE, msg.sender), "CONSTANT_SETTER_ROLE is required");
        emit MinTransactionGasWasChanged(minTransactionGas, newMinTransactionGas);
        minTransactionGas = newMinTransactionGas;
    }

    function getBalance(address user, string calldata schainName) external view returns (uint) {
        return _userWallets[user][keccak256(abi.encodePacked(schainName))];
    }
}
