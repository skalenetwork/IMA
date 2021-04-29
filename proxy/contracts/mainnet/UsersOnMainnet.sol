// SPDX-License-Identifier: AGPL-3.0-only

/*
    UsersOnMainnet.sol - SKALE Manager
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
import "./IMAConnected.sol";
import "@nomiclabs/buidler/console.sol";
/**
 * @title UsersOnMainnet
 * @dev Contract contains logic to perform automatic self-recharging ether for nodes
 */
contract UsersOnMainnet is IMAConnected {
    mapping(address => mapping(bytes32 => uint)) private _userWallets;
    mapping(address => bool) private _unfrozenUsers;
    mapping(bytes32 => address) public schainLinks;

    uint public constant MIN_TRANSACTION_GAS = 500000;

    function refundGasByUser(
        bytes32 schainHash,
        address payable node,
        address user,
        uint gas
    ) 
        external
        onlyMessageProxy
    {
        require(_unfrozenUsers[user], "User should be unfrozen");
        uint amount = tx.gasprice * gas;
        _userWallets[user][schainHash] = _userWallets[user][schainHash].sub(amount);
        if (_userWallets[user][schainHash] < MIN_TRANSACTION_GAS * tx.gasprice) {
            _unfrozenUsers[user] = false;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeFreezeStateMessage(user, false)
            );
        }
        node.transfer(amount);
    }

    function rechargeUserWallet(string calldata schainID) external payable {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(
            msg.value.add(_userWallets[msg.sender][schainHash]) >=
                MIN_TRANSACTION_GAS * tx.gasprice,
            "Not enough money for transaction"
        );
        _userWallets[msg.sender][schainHash] = _userWallets[msg.sender][schainHash].add(msg.value);
        if (!_unfrozenUsers[msg.sender]) {
            _unfrozenUsers[msg.sender] = true;
            messageProxy.postOutgoingMessage(
                schainHash,
                schainLinks[schainHash],
                Messages.encodeFreezeStateMessage(msg.sender, true)
            );
        }
    }

    function withdrawFunds(string calldata schainID, uint amount) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(amount <= _userWallets[msg.sender][schainHash], "Balance is too low");
        _userWallets[msg.sender][schainHash] = _userWallets[msg.sender][schainHash].sub(amount);
        if (_userWallets[msg.sender][schainHash] < MIN_TRANSACTION_GAS * tx.gasprice 
            && _unfrozenUsers[msg.sender]) {
            messageProxy.postOutgoingMessage(
                keccak256(abi.encodePacked(schainID)),
                schainLinks[keccak256(abi.encodePacked(schainID))],
                Messages.encodeFreezeStateMessage(msg.sender, true)
            );
        }
        msg.sender.transfer(amount);
    }

    function linkToContractOnSchain(string calldata schainID, address contractOnSchain) external {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainLinks[schainHash] == address(0), "SKALE chain is already set");
        require(contractOnSchain != address(0), "Incorrect address for contract on Schain");
        schainLinks[schainHash] = contractOnSchain;
    }

    function unlinkFromContractOnSchain(string calldata schainID) external {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainLinks[schainHash] != address(0), "SKALE chain is not set");
        delete schainLinks[schainHash];
    }

    function getBalance(string calldata schainID) external view returns (uint) {
        return _userWallets[msg.sender][keccak256(abi.encodePacked(schainID))];
    }

    function initialize(
        address newContractManagerOfSkaleManager,
        address newMessageProxyAddress,
        address newIMALinkerAddress
    )
        public
        override
        initializer
    {
        IMAConnected.initialize(newIMALinkerAddress, newContractManagerOfSkaleManager, newMessageProxyAddress);
    }
}
