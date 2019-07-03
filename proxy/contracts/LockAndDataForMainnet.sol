pragma solidity ^0.5.0;

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

    constructor() Ownable() public {

    }

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
        require(length > 0, "Given contracts address is not contain code");
        permitted[contractId] = newContract;
    }

    function addSchain(string memory schainID, address tokenManagerAddress) public onlyOwner {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0), "Schain is already set");
        require(tokenManagerAddress != address(0), "Incorrect Token Manager address");
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
    }

    function approveTransfer(address to, uint amount) public allow("DepositBox") {
        approveTransfers[to] += amount;
    }

    function getMyEth() public {
        require(address(this).balance >= approveTransfers[msg.sender], "Not enough money");
        require(approveTransfers[msg.sender] > 0, "User has not money");
        uint amount = approveTransfers[msg.sender];
        approveTransfers[msg.sender] = 0;
        msg.sender.transfer(amount);
    }

    function sendEth(address payable to, uint amount) public allow("DepositBox") returns (bool) {
        require(address(this).balance >= amount, "Not enough money");
        to.transfer(amount);
        return true;
    }
}