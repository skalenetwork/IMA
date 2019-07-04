/**
 *   LockAndDataForMainnet.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE-IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE-IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE-IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity ^0.5.7;

import "./Ownable.sol";

contract LockAndDataForMainnet is Ownable {

    mapping(bytes32 => address) public permitted;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(address => uint) public approveTransfers;

    modifier allow(string memory contractName) {
        require(permitted[keccak256(abi.encodePacked(contractName))] == msg.sender, "Not allowed");
        _;
    }

    event MoneyReceived(address from, uint amount);

    function receiveEth(address from) public allow("DepositBox") payable {
        emit MoneyReceived(from, msg.value);
    }

    function setContract(string memory contractName, address newContract) public onlyOwner {
        require(newContract != address(0), "New address is equal zero");
        bytes32 contractId = keccak256(abi.encodePacked(contractName));
        require(permitted[contractId] != newContract, "Contract is already added");
        uint length;
        assembly {
            length := extcodesize(newContract)
        }
        require(length > 0, "Given contracts address does not contain code");
        permitted[contractId] = newContract;
    }

    function addSchain(string memory schainID, address tokenManagerAddress) public onlyOwner {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0), "SKALE chain is already set");
        require(tokenManagerAddress != address(0), "Incorrect Token Manager address");
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
    }

    function approveTransfer(address to, uint amount) public allow("DepositBox") {
        approveTransfers[to] += amount;
    }

    function getMyEth() public {
        require(address(this).balance >= approveTransfers[msg.sender], "Not enough ETH");
        require(approveTransfers[msg.sender] > 0, "User has insufficient ETH");
        uint amount = approveTransfers[msg.sender];
        approveTransfers[msg.sender] = 0;
        msg.sender.transfer(amount);
    }

    function sendEth(address payable to, uint amount) public allow("DepositBox") returns (bool) {
        require(address(this).balance >= amount, "Not enough ETH");
        to.transfer(amount);
        return true;
    }
}