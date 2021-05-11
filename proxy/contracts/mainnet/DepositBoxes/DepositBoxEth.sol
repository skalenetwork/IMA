// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxEth.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../DepositBox.sol";
import "../../Messages.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxEth is DepositBox {

    using SafeMathUpgradeable for uint;

    // uint256 public gasConsumption;

    mapping(bytes32 => address) public tokenManagerEthAddresses;

    mapping(address => uint256) public approveTransfers;

    modifier rightTransaction(string memory schainID) {
        require(
            keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")),
            "SKALE chain name is incorrect"
        );
        _;
    }

    receive() external payable {
        revert("Use deposit function");
    }

    /**
     * @dev Adds a TokenManagerEth address to
     * DepositBoxEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addSchainContract(string calldata schainName, address newTokenManagerEthAddress) external override {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(DEPOSIT_BOX_MANAGER_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainId) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        require(tokenManagerEthAddresses[schainId] == address(0), "SKALE chain is already set");
        require(newTokenManagerEthAddress != address(0), "Incorrect Token Manager address");

        tokenManagerEthAddresses[schainId] = newTokenManagerEthAddress;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerEth on SKALE chain
     * from DepositBoxEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeSchainContract(string calldata schainName) external override {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(DEPOSIT_BOX_MANAGER_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainId) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
        require(tokenManagerEthAddresses[schainId] != address(0), "SKALE chain is not set");

        delete tokenManagerEthAddresses[schainId];
    }

    function deposit(string memory schainID, address to)
        external
        payable
        // receivedEth
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = tokenManagerEthAddresses[schainHash];
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(to != address(0), "Community Pool is not available");
        messageProxy.postOutgoingMessage(
            schainHash,
            tokenManagerAddress,
            Messages.encodeTransferEthMessage(to, msg.value)
        );
    }

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        returns (address)
    {
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == tokenManagerEthAddresses[schainHash],
            "Receiver chain is incorrect"
        );
        Messages.TransferEthMessage memory message = Messages.decodeTransferEthMessage(data);
        require(
            message.amount <= address(this).balance,
            "Not enough money to finish this transaction"
        );
        approveTransfers[message.receiver] =
            approveTransfers[message.receiver].add(message.amount);
        return message.receiver;
    }

    /**
     * @dev Transfers a user's ETH.
     *
     * Requirements:
     *
     * - LockAndDataForMainnet must have sufficient ETH.
     * - User must be approved for ETH transfer.
     */
    function getMyEth() external {
        require(
            address(this).balance >= approveTransfers[msg.sender],
            "Not enough ETH. in `DepositBox.getMyEth`"
        );
        require(approveTransfers[msg.sender] > 0, "User has insufficient ETH");
        uint256 amount = approveTransfers[msg.sender];
        approveTransfers[msg.sender] = 0;
        msg.sender.transfer(amount);
    }

    /**
     * @dev Checks whether depositBoxEth is connected to a SKALE chain TokenManagerEth.
     */
    function hasSchainContract(string calldata schainID) external view override returns (bool) {
        return tokenManagerEthAddresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /// Create a new deposit box
    function initialize(
        IContractManager newContractManagerOfSkaleManager,        
        Linker newLinkerAddress,
        MessageProxyForMainnet newMessageProxyAddress
    )
        public
        override
        initializer
    {
        DepositBox.initialize(newContractManagerOfSkaleManager, newLinkerAddress, newMessageProxyAddress);
    }
}
