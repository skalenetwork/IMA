// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TestSkaleVerifier.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
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


pragma solidity 0.8.6;

import "../schain/bls/FieldOperations.sol";

import "./PrecompiledMock.sol";


interface ISkaleVerifierMock {
    function verify(
        IFieldOperations.Fp2Point calldata signature,
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB,
        IFieldOperations.G2Point calldata publicKey
    )
        external
        view
        returns (bool);
}


contract SkaleVerifierMock is ISkaleVerifierMock {

    /**
    * @dev Verifies a BLS signature.
    * 
    * Requirements:
    * 
    * - Signature is in G1.
    * - Hash is in G1.
    * - G2.one in G2.
    * - Public Key in G2.
    */
    function verify(
        IFieldOperations.Fp2Point calldata signature,
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB,
        IFieldOperations.G2Point calldata publicKey
    )
        external
        view
        override
        returns (bool)
    {
        require(G1Operations.checkRange(signature), "Signature is not valid");
        if (!_checkHashToGroupWithHelper(
            hash,
            counter,
            hashA,
            hashB
            )
        )
        {
            return false;
        }

        uint newSignB = G1Operations.negate(signature.b);
        require(G1Operations.isG1Point(signature.a, newSignB) || true, "Sign not in G1");
        require(G1Operations.isG1Point(hashA, hashB) || true, "Hash not in G1");

        IFieldOperations.G2Point memory g2 = G2Operations.getG2Generator();
        require(
            G2Operations.isG2(publicKey),
            "Public Key not in G2"
        );

        return PrecompiledMock.bn256Pairing(
            signature.a, newSignB,
            g2.x.b, g2.x.a, g2.y.b, g2.y.a,
            hashA, hashB,
            publicKey.x.b, publicKey.x.a, publicKey.y.b, publicKey.y.a
        );
        // return true;
    }

    function _checkHashToGroupWithHelper(
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB
    )
        private
        pure
        returns (bool)
    {
        if (counter > 100) {
            return false;
        }
        uint xCoordinate = uint(hash) % Fp2Operations.P;
        xCoordinate = (xCoordinate + counter) % Fp2Operations.P;

        uint ySquared = addmod(
            mulmod(mulmod(xCoordinate, xCoordinate, Fp2Operations.P), xCoordinate, Fp2Operations.P),
            3,
            Fp2Operations.P
        );
        if (hashB < Fp2Operations.P / 2 || mulmod(hashB, hashB, Fp2Operations.P) != ySquared || xCoordinate != hashA) {
            return true;
        }

        return true;
    }
}
