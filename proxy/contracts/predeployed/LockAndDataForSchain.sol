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

import "./../Ownable.sol";

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

    bool isVariablesSet = false;

    // modifier setVariables() {
    //     if (!isVariablesSet) {
    //         address newEthERC20Address;
    //         address newOwner;
    //         uint length;
    //         assembly {
    //             newEthERC20Address := sload(0x00)
    //             newOwner := sload(0x01)
    //             length := sload(0x02)
    //         }
    //         ethERC20Address = newEthERC20Address;
    //         owner = newOwner;
    //         address callerAddr;
    //         assembly {
    //             callerAddr := sload(0x03)
    //         }
    //         permitted[keccak256(abi.encodePacked("TokenManager"))] = callerAddr;
    //         assembly {
    //             callerAddr := sload(0x04)
    //         }
    //         permitted[keccak256(abi.encodePacked("ERC20Module"))] = callerAddr;
    //         assembly {
    //             callerAddr := sload(0x05)
    //         }
    //         permitted[keccak256(abi.encodePacked("LockAndDataERC20"))] = callerAddr;
    //         assembly {
    //             callerAddr := sload(0x06)
    //         }
    //         permitted[keccak256(abi.encodePacked("ERC721Module"))] = callerAddr;
    //         assembly {
    //             callerAddr := sload(0x07)
    //         }
    //         permitted[keccak256(abi.encodePacked("LockAndDataERC721"))] = callerAddr;
    //         assembly {
    //             callerAddr := sload(0x08)
    //         }
    //         permitted[keccak256(abi.encodePacked("TokenFactory"))] = callerAddr;
    //         bytes1 index = 0x09;
    //         for (uint i = 0; i < length; i++) {
    //             assembly {
    //                 callerAddr := sload(add(index, i))
    //             }
    //             authorizedCaller[callerAddr] = true;
    //         }

    //         isVariablesSet = true;
    //     }
    //     _;
    // }

    modifier allow(string memory contractName) {
        require(
            permitted[keccak256(abi.encodePacked(contractName))] == msg.sender ||
            owner == msg.sender, "Not allowed LockAndDataForSchain");
        _;
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
        if (!isVariablesSet) {
            setVariables();
        }
        require(authorizedCaller[msg.sender] || owner == msg.sender, "Not authorized caller");
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
        if (!isVariablesSet) {
            setVariables();
        }
        require(authorizedCaller[msg.sender] || owner == msg.sender, "Not authorized caller");
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

    function removeGasCosts(address to) external allow("TokenManager") returns (uint balance) {
        balance = ethCosts[to];
        delete ethCosts[to];
    }

    function sendEth(address to, uint amount) external allow("TokenManager") returns (bool) {
        require(IETHERC20(ethERC20Address).mint(to, amount), "Mint error");
        return true;
    }

    function receiveEth(address sender, uint amount) external allow("TokenManager") returns (bool) {
        IETHERC20(ethERC20Address).burnFrom(sender, amount);
        return true;
    }

    function setVariables() internal {
        address newEthERC20Address;
        address newOwner;
        uint length;
        assembly {
            newEthERC20Address := sload(0x00)
            newOwner := sload(0x01)
        }
        ethERC20Address = newEthERC20Address;
        owner = newOwner;
        address callerAddr;
        assembly {
            callerAddr := sload(0x02)
        }
        permitted[keccak256(abi.encodePacked("TokenManager"))] = callerAddr;
        assembly {
            callerAddr := sload(0x03)
        }
        permitted[keccak256(abi.encodePacked("ERC20Module"))] = callerAddr;
        assembly {
            callerAddr := sload(0x04)
        }
        permitted[keccak256(abi.encodePacked("LockAndDataERC20"))] = callerAddr;
        assembly {
            callerAddr := sload(0x05)
        }
        permitted[keccak256(abi.encodePacked("ERC721Module"))] = callerAddr;
        assembly {
            callerAddr := sload(0x06)
        }
        permitted[keccak256(abi.encodePacked("LockAndDataERC721"))] = callerAddr;
        assembly {
            callerAddr := sload(0x07)
            length := sload(0x08)
        }
        permitted[keccak256(abi.encodePacked("TokenFactory"))] = callerAddr;
        bytes1 index = 0x09;
        for (uint i = 0; i < length; i++) {
            assembly {
                callerAddr := sload(add(index, i))
            }
            authorizedCaller[callerAddr] = true;
        }
        isVariablesSet = true;
    }
}
