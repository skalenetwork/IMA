// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   SkaleFeaturesMock.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@nomiclabs/buidler/console.sol";

import "../schain/bls/FieldOperations.sol";
import "../schain/SkaleFeatures.sol";


contract SkaleFeaturesMock is SkaleFeatures {
    
    G2Operations.G2Point public blsCommonPublicKey;
    address public schainOwner;

    function setBlsCommonPublicKey(G2Operations.G2Point calldata key) external {
        G2Operations.G2Point memory _key = key;
        blsCommonPublicKey = _key;        
    }

    function setSchainOwner(address _schainOwner) external {
        schainOwner = _schainOwner;
    }

    function getConfigVariableUint256(string calldata key) external view override returns (uint) {
        if (_equal(key, "skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey0")) {
            return blsCommonPublicKey.x.a;
        } else if (_equal(key, "skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey1")) {
            return blsCommonPublicKey.x.b;
        } else if (_equal(key, "skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey2")) {
            return blsCommonPublicKey.y.a;
        } else if (_equal(key, "skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey3")) {
            return blsCommonPublicKey.y.b;
        } else {
            revert("The key is not implemented in the mock");
        }
    }

    function _equal(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

