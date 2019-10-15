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

pragma solidity ^0.5.3;

import "./Ownable.sol";


contract LockAndDataForMainnet is Ownable {

    mapping(bytes32 => address) public permitted;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(address => uint) public approveTransfers;

    mapping(address => bool) public authorizedCaller;

    modifier allow(string memory contractName) {
        require(permitted[keccak256(abi.encodePacked(contractName))] == msg.sender || owner == msg.sender, "Not allowed");
        _;
    }

    event MoneyReceived(address from, uint amount);

    event Error(
        address to,
        uint amount,
        string message
    );

    constructor() Ownable() public {
        authorizedCaller[msg.sender] = true;
    }

    function receiveEth(address from) external allow("DepositBox") payable {
        emit MoneyReceived(from, msg.value);
    }

    function setContract(string calldata contractName, address newContract) external onlyOwner {
        require(newContract != address(0), "New address is equal zero");
        bytes32 contractId = keccak256(abi.encodePacked(contractName));
        require(permitted[contractId] != newContract, "Contract is already added");
        uint length;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            length := extcodesize(newContract)
        }
        require(length > 0, "Given contract address does not contain code");
        permitted[contractId] = newContract;
    }

    function hasSchain( string calldata schainID ) external view returns (bool) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        if ( tokenManagerAddresses[schainHash] == address(0) ) {
            return false;
        }
        return true;
    }

    function addSchain(string calldata schainID, address tokenManagerAddress) external {
        require(authorizedCaller[msg.sender], "Not authorized caller");
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0), "SKALE chain is already set");
        require(tokenManagerAddress != address(0), "Incorrect Token Manager address");
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
    }

    function removeSchain(string calldata schainID) external onlyOwner {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerAddresses[schainHash];
    }

    function addAuthorizedCaller(address caller) external onlyOwner {
        authorizedCaller[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external onlyOwner {
        authorizedCaller[caller] = false;
    }

    function approveTransfer(address to, uint amount) external allow("DepositBox") {
        approveTransfers[to] += amount;
    }

    function getMyEth() external {
        require(address(this).balance >= approveTransfers[msg.sender], "Not enough ETH. in `LockAndDataForMainnet.getMyEth`");
        require(approveTransfers[msg.sender] > 0, "User has insufficient ETH");
        uint amount = approveTransfers[msg.sender];
        approveTransfers[msg.sender] = 0;
        msg.sender.transfer(amount);
    }

    function sendEth(address payable to, uint amount) external allow("DepositBox") returns (bool) {
        // require(address(this).balance >= amount, "Not enough ETH. in `LockAndDataForMainnet.sendEth`");
        if (address(this).balance < amount) {
            emit Error(
                to,
                amount,
                "Not enough ETH. in `LockAndDataForMainnet.sendEth`"
            );
            return false;
        }
        to.transfer(amount);
        return true;
    }
}
