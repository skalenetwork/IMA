// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForSchain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/IKeyStorage.sol";

import "./bls/FieldOperations.sol";


/**
 * @title KeyStorage
 * @dev Holds common BLS public key.
 */
contract KeyStorage is IKeyStorage, AccessControlEnumerableUpgradeable {

    uint256 public constant FREE_MEM_PTR = 0x40;

    /**
     * @dev Address of custom precompiled contract on SKALE chain
     * to get uin256 value from the config.
     */
    uint256 public constant FN_NUM_GET_CONFIG_VARIABLE_UINT256 = 0x13;
    /**
     * @dev Address of custom precompiled contract on SKALE chain
     * to get current BLS public key.
     */
    uint256 public constant FN_NUM_GET_CURRENT_BLS_PUBLIC_KEY = 0x19;

    /**
     * @dev Is called once during contract deployment.
     */
    function initialize()
        external
        override
        initializer
    {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Get BLS common public key.
     */
    function getBlsCommonPublicKey() external view override virtual returns (IFieldOperations.G2Point memory) {
        return _getCurrentBLSPublicKey();
    }

    // private

    /**
     * @dev Get uint256 value from the skaled config.
     */
    function _getConfigVariableUint256(
        string memory strConfigVariableName
    )
        private
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

    /**
     * @dev Get current BLS public key the skaled.
     */
    function _getCurrentBLSPublicKey()
        private
        view
        returns ( IFieldOperations.G2Point memory pk )
    {
        uint256 fmp = FREE_MEM_PTR;
        bool success;
        uint xa;
        uint xb;
        uint ya;
        uint yb;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(fmp)
            success := staticcall(not(0), FN_NUM_GET_CURRENT_BLS_PUBLIC_KEY, ptr, 0, ptr, 128)
            xa := mload(ptr)
            xb := mload(add(ptr, 32))
            ya := mload(add(ptr, 64))
            yb := mload(add(ptr, 96))
        }
        pk.x.a = xa;
        pk.x.b = xb;
        pk.y.a = ya;
        pk.y.b = yb;
        require(success, "Get current BLS public key failed");
    }
}
