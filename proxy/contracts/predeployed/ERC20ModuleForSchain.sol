// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC20ModuleForSchain.sol - SKALE Interchain Messaging Agent
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

pragma solidity ^0.5.3;

import "./PermissionsForSchain.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

interface ITokenFactoryForERC20 {
    function createERC20(bytes calldata data)
        external
        returns (address payable);
}

interface ILockAndDataERC20S {
    function erc20Tokens(uint256 index) external returns (address);
    function erc20Mapper(address contractERC20) external returns (uint256);
    function addERC20Token(address contractERC20, uint256 contractPosition) external;
    function sendERC20(address contractHere, address to, uint256 amount) external returns (bool);
    function receiveERC20(address contractHere, uint256 amount) external returns (bool);
}

interface ERC20Clone {
    function totalSupplyOnMainnet() external view returns (uint256);
    function setTotalSupplyOnMainnet(uint256 newTotalSupply) external;
}


contract ERC20ModuleForSchain is PermissionsForSchain {

    event ERC20TokenCreated(uint256 indexed contractPosition, address tokenThere);
    event ERC20TokenReceived(uint256 indexed contractPosition, address tokenThere, uint256 amount);


    constructor(address newLockAndDataAddress) PermissionsForSchain(newLockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function receiveERC20(
        address contractHere,
        address to,
        uint256 amount,
        bool isRAW) external allow("TokenManager") returns (bytes memory data)
        {
        address lockAndDataERC20 = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        if (!isRAW) {
            uint256 contractPosition = ILockAndDataERC20S(lockAndDataERC20).erc20Mapper(contractHere);
            require(contractPosition > 0, "Not existing ERC-20 contract");
            require(ILockAndDataERC20S(lockAndDataERC20).receiveERC20(contractHere, amount), "Cound not receive ERC20 Token");
            data = encodeData(
                contractHere,
                contractPosition,
                to,
                amount);
            return data;
        } else {
            data = encodeRawData(to, amount);
            return data;
        }
    }

    function sendERC20(address to, bytes calldata data) external allow("TokenManager") returns (bool) {
        address lockAndDataERC20 = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        uint256 contractPosition;
        address contractAddress;
        address receiver;
        uint256 amount;
        if (to == address(0)) {
            (contractPosition, receiver, amount) = fallbackDataParser(data);
            contractAddress = ILockAndDataERC20S(lockAndDataERC20).erc20Tokens(contractPosition);
            if (contractAddress == address(0)) {
                address tokenFactoryAddress = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("TokenFactory")));
                contractAddress = ITokenFactoryForERC20(tokenFactoryAddress).createERC20(data);
                emit ERC20TokenCreated(contractPosition, contractAddress);
                ILockAndDataERC20S(lockAndDataERC20).addERC20Token(contractAddress, contractPosition);
            } else {
                uint256 totalSupply = fallbackTotalSupplyParser(data);
                if (totalSupply > ERC20Clone(contractAddress).totalSupplyOnMainnet()) {
                    ERC20Clone(contractAddress).setTotalSupplyOnMainnet(totalSupply);
                }
            }
            emit ERC20TokenReceived(contractPosition, contractAddress, amount);
        } else {
            (receiver, amount) = fallbackRawDataParser(data);
            contractAddress = to;
            emit ERC20TokenReceived(0, contractAddress, amount);
        }
        return ILockAndDataERC20S(lockAndDataERC20).sendERC20(contractAddress, receiver, amount);
    }

    function getReceiver(address to, bytes calldata data) external pure returns (address receiver) {
        uint256 contractPosition;
        uint256 amount;
        if (to == address(0)) {
            (contractPosition, receiver, amount) = fallbackDataParser(data);
        } else {
            (receiver, amount) = fallbackRawDataParser(data);
        }
    }

    function encodeData(
        address contractHere,
        uint256 contractPosition,
        address to,
        uint256 amount) internal view returns (bytes memory data)
        {
        string memory name = ERC20Detailed(contractHere).name();
        uint8 decimals = ERC20Detailed(contractHere).decimals();
        string memory symbol = ERC20Detailed(contractHere).symbol();
        uint256 totalSupply = ERC20Detailed(contractHere).totalSupply();
        data = abi.encodePacked(
            bytes1(uint8(3)),
            bytes32(contractPosition),
            bytes32(bytes20(to)),
            bytes32(amount),
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol,
            decimals,
            totalSupply
        );
    }

    function encodeRawData(address to, uint256 amount) internal pure returns (bytes memory data) {
        data = abi.encodePacked(
            bytes1(uint8(19)),
            bytes32(bytes20(to)),
            bytes32(amount)
        );
    }

    function fallbackTotalSupplyParser(bytes memory data)
        internal
        pure
        returns (uint256)
    {
        bytes32 totalSupply;
        bytes32 nameLength;
        bytes32 symbolLength;
        assembly {
            nameLength := mload(add(data, 129))
        }
        uint256 lengthOfName = uint256(nameLength);
        assembly {
            symbolLength := mload(add(data, add(161, lengthOfName)))
        }
        uint256 lengthOfSymbol = uint256(symbolLength);
        assembly {
            totalSupply := mload(add(data,
                add(194, add(lengthOfName, lengthOfSymbol))))
        }
        return uint256(totalSupply);
    }

    function fallbackDataParser(bytes memory data)
        internal
        pure
        returns (uint256, address payable, uint256)
    {
        bytes32 contractIndex;
        bytes32 to;
        bytes32 token;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            contractIndex := mload(add(data, 33))
            to := mload(add(data, 65))
            token := mload(add(data, 97))
        }
        return (
            uint256(contractIndex), address(bytes20(to)), uint256(token)
        );
    }

    function fallbackRawDataParser(bytes memory data)
        internal
        pure
        returns (address payable, uint256)
    {
        bytes32 to;
        bytes32 token;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            to := mload(add(data, 33))
            token := mload(add(data, 65))
        }
        return (address(bytes20(to)), uint256(token));
    }
}
