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

pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

import "./PermissionsForSchain.sol";


interface ITokenFactoryForERC20 {
    function createERC20(string memory name, string memory symbol, uint256 totalSupply)
        external
        returns (address payable);
}

interface ILockAndDataERC20S {
    function addERC20ForSchain(string calldata schainID, address erc20OnMainnet, address erc20OnSchain) external;
    function sendERC20(address contractOnSchain, address to, uint256 amount) external returns (bool);
    function receiveERC20(address contractOnSchain, uint256 amount) external returns (bool);
    function setTotalSupplyOnMainnet(address contractOnSchain, uint256 newTotalSupplyOnMainnet) external;
    function getERC20OnSchain(string calldata schainID, address contractOnMainnet) external view returns (address);
    function totalSupplyOnMainnet(address contractOnSchain) external view returns (uint256);
}

/**
 * @title ERC20 Module For SKALE Chain
 * @dev Runs on SKALE Chains and manages ERC20 token contracts for TokenManager.
 */
contract ERC20ModuleForSchain is PermissionsForSchain {

    event ERC20TokenCreated(string schainID, address indexed contractOnMainnet, address contractOnSchain);
    event ERC20TokenReceived(address indexed contractOnMainnet, address contractOnSchain, uint256 amount);


    constructor(address newLockAndDataAddress) public PermissionsForSchain(newLockAndDataAddress) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Allows TokenManager to receive ERC20 tokens.
     * 
     * Requirements:
     * 
     * - ERC20 token contract must exist in LockAndDataForSchainERC20.
     * - ERC20 token must be received by LockAndDataForSchainERC20.
     */
    function receiveERC20(
        string calldata schainID,
        address contractOnMainnet,
        address receiver,
        uint256 amount
    ) 
        external
        allow("TokenManager")
        returns (bytes memory data)
    {
        address lockAndDataERC20 = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getLockAndDataErc20();
        address contractOnSchain = ILockAndDataERC20S(lockAndDataERC20).getERC20OnSchain(schainID, contractOnMainnet);
        require(contractOnSchain != address(0), "ERC20 contract does not exist on SKALE chain.");
        require(
            ILockAndDataERC20S(lockAndDataERC20).receiveERC20(contractOnSchain, amount),
            "Could not receive ERC20 Token"
        );
        data = _encodeData(contractOnMainnet, contractOnSchain, receiver, amount);
    }

    /**
     * @dev Allows TokenManager to send ERC20 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token does not exist.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function sendERC20(string calldata schainID, bytes calldata data) external allow("TokenManager") returns (bool) {
        address lockAndDataERC20 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc20();
        address contractOnMainnet;
        address receiver;
        uint256 amount;
        (contractOnMainnet, receiver, amount) = _fallbackDataParser(data);
        address contractOnSchain = ILockAndDataERC20S(lockAndDataERC20).getERC20OnSchain(schainID, contractOnMainnet);
        if (contractOnSchain == address(0)) {
            contractOnSchain = _sendCreateERC20Request(data);
            ILockAndDataERC20S(lockAndDataERC20).addERC20ForSchain(schainID, contractOnMainnet, contractOnSchain);
            emit ERC20TokenCreated(schainID, contractOnMainnet, contractOnSchain);
        }
        uint256 totalSupply = _fallbackTotalSupplyParser(data);
        if (totalSupply != ILockAndDataERC20S(lockAndDataERC20).totalSupplyOnMainnet(contractOnSchain)) {
            ILockAndDataERC20S(lockAndDataERC20).setTotalSupplyOnMainnet(contractOnSchain, totalSupply);
        }
        emit ERC20TokenReceived(contractOnMainnet, contractOnSchain, amount);
        return ILockAndDataERC20S(lockAndDataERC20).sendERC20(contractOnSchain, receiver, amount);
    }

    /**
     * @dev Returns the receiver address.
     */
    function getReceiver(bytes calldata data) external view returns (address receiver) {
        (, receiver, ) = _fallbackDataParser(data);
    }

    function _sendCreateERC20Request(bytes calldata data) internal returns (address newToken) {
        string memory name;
        string memory symbol;
        uint256 totalSupply;
        (name, symbol, , totalSupply) = _fallbackDataCreateERC20Parser(data);
        address tokenFactoryAddress = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getTokenFactory();
        newToken = ITokenFactoryForERC20(tokenFactoryAddress).createERC20(name, symbol, totalSupply);
    }

    /**
     * @dev Returns encoded creation data.
     */
    function _encodeData(
        address contractOnMainnet,
        address contractOnSchain,
        address to,
        uint256 amount
    )
        private
        view
        returns (bytes memory data)
    {
        string memory name = ERC20UpgradeSafe(contractOnSchain).name();
        uint8 decimals = ERC20UpgradeSafe(contractOnSchain).decimals();
        string memory symbol = ERC20UpgradeSafe(contractOnSchain).symbol();
        uint256 totalSupply = ERC20UpgradeSafe(contractOnSchain).totalSupply();
        data = abi.encodePacked(
            bytes1(uint8(3)),
            bytes32(bytes20(contractOnMainnet)),
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

    // /**
    //  * @dev Returns encoded regular data.
    //  */
    // function _encodeRegularData(
    //     address contractOnMainnet,
    //     address to,
    //     uint256 amount
    // )
    //     private
    //     pure
    //     returns (bytes memory data)
    // {
    //     data = abi.encodePacked(
    //         bytes1(uint8(19)),
    //         bytes32(bytes20(contractOnMainnet)),
    //         bytes32(bytes20(to)),
    //         bytes32(amount)
    //     );
    // }

    /**
     * @dev Returns fallback total supply data.
     */
    function _fallbackTotalSupplyParser(bytes memory data)
        private
        pure
        returns (uint256)
    {
        bytes32 totalSupply;
        bytes32 nameLength;
        bytes32 symbolLength;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            nameLength := mload(add(data, 129))
        }
        uint256 lengthOfName = uint256(nameLength);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            symbolLength := mload(add(data, add(161, lengthOfName)))
        }
        uint256 lengthOfSymbol = uint256(symbolLength);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            totalSupply := mload(add(data,
                add(194, add(lengthOfName, lengthOfSymbol))))
        }
        return uint256(totalSupply);
    }

    /**
     * @dev Returns fallback data.
     */
    function _fallbackDataParser(bytes memory data)
        private
        pure
        returns (address, address payable, uint256)
    {
        bytes32 contractOnMainnet;
        bytes32 to;
        bytes32 tokenAmount;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractOnMainnet := mload(add(data, 33))
            to := mload(add(data, 65))
            tokenAmount := mload(add(data, 97))
        }
        return (
            address(bytes20(contractOnMainnet)), address(bytes20(to)), uint256(tokenAmount)
        );
    }

    function _fallbackDataCreateERC20Parser(bytes memory data)
        private
        pure
        returns (
            string memory name,
            string memory symbol,
            uint8,
            uint256
        )
    {
        bytes1 decimals;
        bytes32 totalSupply;
        bytes32 nameLength;
        bytes32 symbolLength;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            nameLength := mload(add(data, 129))
        }
        name = new string(uint256(nameLength));
        for (uint256 i = 0; i < uint256(nameLength); i++) {
            bytes(name)[i] = data[129 + i];
        }
        uint256 lengthOfName = uint256(nameLength);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            symbolLength := mload(add(data, add(161, lengthOfName)))
        }
        symbol = new string(uint256(symbolLength));
        for (uint256 i = 0; i < uint256(symbolLength); i++) {
            bytes(symbol)[i] = data[161 + lengthOfName + i];
        }
        uint256 lengthOfSymbol = uint256(symbolLength);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            decimals := mload(add(data,
                add(193, add(lengthOfName, lengthOfSymbol))))
            totalSupply := mload(add(data,
                add(194, add(lengthOfName, lengthOfSymbol))))
        }
        return (
            name,
            symbol,
            uint8(decimals),
            uint256(totalSupply)
            );
    }
}
