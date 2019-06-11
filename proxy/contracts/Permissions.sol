pragma solidity ^0.5.0;

import "./Ownable.sol";

interface ContractManager {
    function permitted(bytes32 contractName) external view returns (address);
}

/**
 * @title Permissions - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract Permissions is Ownable {
    
    // address of ContractManager
    address lockAndDataAddress;

    /**
     * @dev allow - throws if called by any account and contract other than the owner 
     * or `contractName` contract
     * @param contractName - human readable name of contract
     */
    modifier allow(string memory contractName) {
        require(ContractManager(lockAndDataAddress).permitted(keccak256(abi.encodePacked(contractName))) == msg.sender || owner == msg.sender, "Message sender is invalid");
        _;
    }

    /**
     * @dev constructor - sets current address of ContractManager
     * @param newContractsAddress - current address of ContractManager
     */
    constructor(address newContractsAddress) public {
        lockAndDataAddress = newContractsAddress;
    }
}
