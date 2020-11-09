// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC20ModuleForMainnet.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.6.10;

import "./PermissionsForMainnet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

interface ILockAndDataERC20M {
    function erc20Tokens(uint256 index) external returns (address);
    function erc20Mapper(address contractERC20) external returns (uint256);
    function addERC20Token(address contractERC20) external returns (uint256);
    function sendERC20(address contractHere, address to, uint256 amount) external returns (bool);
}


contract ERC20ModuleForMainnet is PermissionsForMainnet {

    event ERC20TokenAdded(address indexed tokenHere, uint256 contractPosition);
    event ERC20TokenSent(address indexed tokenHere, uint256 contractPosition, uint256 amount);

    function receiveERC20(
        address contractHere,
        address to,
        uint256 amount,
        bool isRAW
    )
        external
        allow("DepositBox")
        returns (bytes memory data)
    {
        address lockAndDataERC20 = IContractManagerForMainnet(lockAndDataAddress_).permitted(
            keccak256(abi.encodePacked("LockAndDataERC20"))
        );
        uint256 totalSupply = ERC20UpgradeSafe(contractHere).totalSupply();
        require(amount <= totalSupply, "TotalSupply is not correct");
        uint256 contractPosition = ILockAndDataERC20M(lockAndDataERC20).erc20Mapper(contractHere);
        if (contractPosition == 0) {
            contractPosition = ILockAndDataERC20M(lockAndDataERC20).addERC20Token(contractHere);
            emit ERC20TokenAdded(contractHere, contractPosition);
        }
        if (!isRAW) {
            data = _encodeCreationData(
                contractHere,
                contractPosition,
                to,
                amount
            );
        } else {
            data = _encodeRegularData(to, contractPosition, amount);
        }
        emit ERC20TokenSent(contractHere, contractPosition, amount);
        return data;
    }

    function sendERC20(address to, bytes calldata data) external allow("DepositBox") returns (bool) {
        address lockAndDataERC20 = IContractManagerForMainnet(lockAndDataAddress_).permitted(
            keccak256(abi.encodePacked("LockAndDataERC20"))
        );
        uint256 contractPosition;
        address contractAddress;
        address receiver;
        uint256 amount;
        (contractPosition, receiver, amount) = _fallbackDataParser(data);
        contractAddress = ILockAndDataERC20M(lockAndDataERC20).erc20Tokens(contractPosition);
        if (to != address(0)) {
            if (contractAddress == address(0)) {
                contractAddress = to;
            }
        }
        bool variable = ILockAndDataERC20M(lockAndDataERC20).sendERC20(contractAddress, receiver, amount);
        return variable;
    }

    function getReceiver(bytes calldata data) external pure returns (address receiver) {
        uint256 contractPosition;
        uint256 amount;
        (contractPosition, receiver, amount) = _fallbackDataParser(data);
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }

    function _encodeCreationData(
        address contractHere,
        uint256 contractPosition,
        address to,
        uint256 amount
    )
        private
        view
        returns (bytes memory data)
    {
        string memory name = ERC20UpgradeSafe(contractHere).name();
        uint8 decimals = ERC20UpgradeSafe(contractHere).decimals();
        string memory symbol = ERC20UpgradeSafe(contractHere).symbol();
        uint256 totalSupply = ERC20UpgradeSafe(contractHere).totalSupply();
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

    function _encodeRegularData(
        address to,
        uint256 contractPosition,
        uint256 amount
    )
        private
        pure
        returns (bytes memory data)
    {
        data = abi.encodePacked(
            bytes1(uint8(19)),
            bytes32(contractPosition),
            bytes32(bytes20(to)),
            bytes32(amount)
        );
    }

    function _fallbackDataParser(bytes memory data)
        private
        pure
        returns (uint256, address payable, uint256)
    {
        bytes32 contractIndex;
        bytes32 to;
        bytes32 token;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractIndex := mload(add(data, 33))
            to := mload(add(data, 65))
            token := mload(add(data, 97))
        }
        return (
            uint256(contractIndex), address(bytes20(to)), uint256(token)
        );
    }

}