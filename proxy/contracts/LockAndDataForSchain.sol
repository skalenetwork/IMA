pragma solidity ^0.5.7;

import "./Ownable.sol";

interface ETHERC20 {
    function mint(address account, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;
}

contract LockAndData is Ownable {

    address public ethERC20Address;

    mapping(bytes32 => address) permitted;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(address => uint) public approveTransfers;

    modifier allow(string memory contractName) {
        require(permitted[keccak256(abi.encodePacked(contractName))] == msg.sender, "Not allowed");
        _;
    }

    constructor() public payable {

    }

    function setEthERC20Address(address newEthERC20Address) public onlyOwner {
        ethERC20Address = newEthERC20Address;
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
        require(tokenManagerAddresses[schainHash] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
    }

    function addDepositBox(address depositBoxAddress) public {
        require(depositBoxAddress != address(0));
        require(
            tokenManagerAddresses[
                keccak256(abi.encodePacked("Mainnet"))
            ] != depositBoxAddress
        );
        tokenManagerAddresses[
            keccak256(abi.encodePacked("Mainnet"))
        ] = depositBoxAddress;
    }

    function approveTransfer(address to, uint amount) public allow("DepositBox") {
        approveTransfers[to] += amount;
    }

    function sendEth(address to, uint amount) public allow("DepositBox") returns (bool) {
        require(ETHERC20(ethERC20Address).mint(to, amount), "Mint error");
    }

    function receiveEth(address sender, uint amount) {
        require(ETHERC20(ethERC20Address).allowance(msg.sender, address(this)) >= amount);
    }
}