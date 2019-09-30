/**
 *   LockAndDataForSchain.sol - SKALE Interchain Messaging Agent
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

interface IETHERC20 {
    function allowance(address from, address to) external returns (uint);
    function mint(address account, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
}


contract LockAndDataForSchain is Ownable {

    address public ethERC20Address;

    mapping(bytes32 => address) public permitted;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(address => uint) public ethCosts;

    mapping(address => bool) public authorizedCaller;

    modifier allow(string memory contractName) {
        require(
            permitted[keccak256(abi.encodePacked(contractName))] == msg.sender ||
            owner == msg.sender, "Not allowed LockAndDataForSchain");
        _;
    }

    constructor() public {
        authorizedCaller[msg.sender] = true;
    }

    function setEthERC20Address(address newEthERC20Address) external onlyOwner {
        ethERC20Address = newEthERC20Address;
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

    function hasDepositBox() external view returns(bool) {
        bytes32 depositBoxHash = keccak256(abi.encodePacked("Mainnet"));
        if ( tokenManagerAddresses[depositBoxHash] == address(0) ) {
            return false;
        }
        return true;
    }

    function addDepositBox(address depositBoxAddress) external {
        require(authorizedCaller[msg.sender], "Not authorized caller");
        require(depositBoxAddress != address(0), "Incorrect Deposit Box address");
        require(
            tokenManagerAddresses[
                keccak256(abi.encodePacked("Mainnet"))
            ] != depositBoxAddress,
            "Deposit Box is already set"
        );
        tokenManagerAddresses[
            keccak256(abi.encodePacked("Mainnet"))
        ] = depositBoxAddress;
    }

    function removeDepositBox() external onlyOwner {
        require(
            tokenManagerAddresses[
                keccak256(abi.encodePacked("Mainnet"))
            ] != address(0),
            "Deposit Box is not set"
        );
        delete tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))];
    }

    function addAuthorizedCaller(address caller) external onlyOwner {
        authorizedCaller[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external onlyOwner {
        authorizedCaller[caller] = false;
    }

    function addGasCosts(address to, uint amount) external allow("TokenManager") {
        ethCosts[to] += amount;
    }

    function reduceGasCosts(address to, uint amount) external allow("TokenManager") returns (bool) {
        if (ethCosts[to] >= amount) {
            ethCosts[to] -= amount;
            return true;
        } else if (ethCosts[address(0)] >= amount) {
            ethCosts[address(0)] -= amount;
            return true;
        }
        return false;
    }

    function sendEth(address to, uint amount) external allow("TokenManager") returns (bool) {
        require(IETHERC20(ethERC20Address).mint(to, amount), "Mint error");
        return true;
    }

    function receiveEth(address sender, uint amount) external allow("TokenManager") returns (bool) {
        IETHERC20(ethERC20Address).burnFrom(sender, amount);
        return true;
    }
}
