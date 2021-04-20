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

import "../interfaces/IDepositBox.sol";
import "../Messages.sol";

import "./IMAConnected.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxEth is IMAConnected, IDepositBox {

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
    function addTokenManager(string calldata schainID, address newTokenManagerEthAddress) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerEthAddresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerEthAddress != address(0), "Incorrect Token Manager address");
        tokenManagerEthAddresses[schainHash] = newTokenManagerEthAddress;
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
    function removeTokenManager(string calldata schainID) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerEthAddresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerEthAddresses[schainHash];
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
        returns (bool)
    {
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == tokenManagerEthAddresses[schainHash],
            "Receiver chain is incorrect"
        );
        Messages.TransferEthMessage memory decodedMessage = Messages.decodeTransferEthMessage(data);
        require(
            decodedMessage.amount <= address(this).balance,
            "Not enough money to finish this transaction"
        );
        approveTransfers[decodedMessage.receiver] =
            approveTransfers[decodedMessage.receiver].add(decodedMessage.amount);
        // TODO add gas reimbusement
        // uint256 txFee = gasConsumption * tx.gasprice;
        // require(amount >= txFee, "Not enough funds to recover gas");
        // TODO add gas reimbusement
        // imaLinker.rechargeSchainWallet(schainId, txFee);
        return true;
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
    function hasTokenManager(string calldata schainID) external view override returns (bool) {
        return tokenManagerEthAddresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /// Create a new deposit box
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
        // gasConsumption = 500000;
    }
}
