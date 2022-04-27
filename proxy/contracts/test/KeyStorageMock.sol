// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   KeyStorageMock.sol - SKALE Interchain Messaging Agent
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

import "../schain/KeyStorage.sol";


interface IKeyStorageMock is IKeyStorage {
    function setBlsCommonPublicKey(IFieldOperations.G2Point calldata key) external;
    function setBlsCommonPublicKeyForSchain(bytes32 schainHash, IFieldOperations.G2Point calldata key) external;
    function getBlsCommonPublicKeyForSchain(bytes32 schainHash) external view returns (IFieldOperations.G2Point memory);
}


contract KeyStorageMock is KeyStorage, IKeyStorageMock {
    
    IFieldOperations.G2Point public blsCommonPublicKey;
    mapping (bytes32 => IFieldOperations.G2Point) public blsCommonPublicKeys;
    string public hello = "Hello";

    function setBlsCommonPublicKey(IFieldOperations.G2Point calldata key) external override {
        // TODO: remove when update compiler will be updated
        IFieldOperations.G2Point memory _key = key;
        blsCommonPublicKey = _key;        
    }

    function setBlsCommonPublicKeyForSchain(
        bytes32 schainHash,
        IFieldOperations.G2Point calldata key
    )
        external
        override
    {
        // TODO: remove when update compiler will be updated
        IFieldOperations.G2Point memory _key = key;
        blsCommonPublicKeys[schainHash] = _key;
    }

    function getBlsCommonPublicKey()
        external
        view
        override(IKeyStorage, KeyStorage)
        returns (IFieldOperations.G2Point memory)
    {
        require(
            !(blsCommonPublicKey.x.a == 0 &&
              blsCommonPublicKey.x.b == 0 &&
              blsCommonPublicKey.y.a == 0 &&
              blsCommonPublicKey.y.b == 0),
            "BLS common public key is not set in the mock"
        );
        return blsCommonPublicKey;
    }

    function getBlsCommonPublicKeyForSchain(
        bytes32 schainHash
    )
        external
        view
        override
        returns (IFieldOperations.G2Point memory)
    {
        IFieldOperations.G2Point memory key = blsCommonPublicKeys[schainHash];
        require(
            !(key.x.a == 0 &&
              key.x.b == 0 &&
              key.y.a == 0 &&
              key.y.b == 0),
            "BLS common public key is not set in the mock"
        );
        return key;
    }
}

