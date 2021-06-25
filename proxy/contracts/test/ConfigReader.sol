// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfigReader.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaiev
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


pragma solidity 0.8.6;


library ConfigReader {
    uint256 public constant FREE_MEM_PTR = 0x40;
    uint256 public constant FN_NUM_LOG_TEXT_MESSAGE = 0x12;
    uint256 public constant FN_NUM_GET_CONFIG_VARIABLE_UINT256 = 0x13;
    uint256 public constant FN_NUM_GET_CONFIG_VARIABLE_ADDRESS = 0x14;
    uint256 public constant FN_NUM_GET_CONFIG_VARIABLE_STRING = 0x15;
    uint256 public constant FN_NUM_RESERVED = 0x16;
    uint256 public constant FN_NUM_GET_CONFIG_PERMISSION_FLAG = 0x17;

    function getConfigVariableUint256(
        string memory strConfigVariableName
    )
        external
        view
        returns ( uint256 rv )
    {
        uint256 fmp = FREE_MEM_PTR;
        uint256 blocks = (bytes(strConfigVariableName).length + 31) / 32 + 1;
        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(fmp)
            for { let i := 0 } lt( i, blocks ) { i := add(1, i) } {
                let where := add(ptr, mul(32, i))
                let what := mload(add(strConfigVariableName, mul(32, i)))
                mstore(where, what)
            }
            success := staticcall(not(0), FN_NUM_GET_CONFIG_VARIABLE_UINT256, ptr, mul( blocks, 32 ), ptr, 32)
            rv := mload(ptr)
        }
        require(success, "Get config uint256 failed");
    }

    function getConfigVariableAddress(
        string memory strConfigVariableName
    )
        external
        view
        returns ( address rv )
    {
        uint256 fmp = FREE_MEM_PTR;
        uint256 blocks = (bytes(strConfigVariableName).length + 31) / 32 + 1;
        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(fmp)
            for { let i := 0 } lt( i, blocks ) { i := add(1, i) } {
                let where := add(ptr, mul(32, i))
                let what := mload(add(strConfigVariableName, mul(32, i)))
                mstore(where, what)
            }
            success := staticcall(not(0), FN_NUM_GET_CONFIG_VARIABLE_ADDRESS, ptr, mul( blocks, 32 ), ptr, 32)
            rv := mload(ptr)
        }
        require(success, "Get config address failed");
    }

    function getConfigVariableString( string memory strConfigVariableName ) public view returns ( string memory rv ) {
        uint256 fmp = FREE_MEM_PTR;
        uint256 blocks = (bytes(strConfigVariableName).length + 31) / 32 + 1;
        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(fmp)
            for { let i := 0 } lt( i, blocks ) { i := add(1, i) } {
                let where := add(ptr, mul(32, i))
                let what := mload(add(strConfigVariableName, mul(32, i)))
                mstore(where, what)
            }
            success := staticcall(
                not(0),
                FN_NUM_GET_CONFIG_VARIABLE_STRING,
                ptr,
                mul( blocks, 32 ),
                rv,
                mul( 1024, 1024 )
            )
        }
        require(success, "Get config string failed");
    }

    function getConfigPermissionFlag(
        address a,
        string memory strConfigVariableName
    )
        public
        view
        returns (uint256 rv)
    {
        uint256 fmp = FREE_MEM_PTR;
        uint256 fnc = FN_NUM_GET_CONFIG_PERMISSION_FLAG;
        uint256 blocks = (bytes(strConfigVariableName).length + 31) / 32 + 1;
        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let p := mload(fmp)
            mstore(p, a)
            let ptr := add(p, 32)
            for { let i := 0 } lt( i, blocks ) { i := add(1, i) } {
                let where := add(ptr, mul(32, i))
                let what := mload(add(strConfigVariableName, mul(32, i)))
                mstore(where, what)
            }
            success := staticcall(not(0), fnc, p, add(64, mul(blocks, 32) ), p, 32)
            rv := mload(ptr)
        }
        require(success, "Get config permission failed");
    }
}
