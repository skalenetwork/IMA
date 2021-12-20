// SPDX-License-Identifier: AGPL-3.0-only

/*
    SkaleVerifier.sol - SKALE Manager
    Copyright (C) 2021-Present SKALE Labs
    @author Dmytro Stebaiev

    SKALE Manager is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SKALE Manager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with SKALE Manager.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.8.6;

import "./Precompiled.sol";
import "./FieldOperations.sol";

/**
 * @title SkaleVerifier
 * @dev Contains verify function to perform BLS signature verification.
 */
library SkaleVerifier {
    using Fp2Operations for IFieldOperations.Fp2Point;


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
        IFieldOperations.Fp2Point memory signature,
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB,
        IFieldOperations.G2Point memory publicKey
    )
        internal
        view
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
        require(G1Operations.isG1Point(signature.a, newSignB), "Sign not in G1");
        require(G1Operations.isG1Point(hashA, hashB), "Hash not in G1");

        IFieldOperations.G2Point memory g2 = G2Operations.getG2Generator();
        require(
            G2Operations.isG2(publicKey),
            "Public Key not in G2"
        );

        return Precompiled.bn256Pairing(
            signature.a, newSignB,
            g2.x.b, g2.x.a, g2.y.b, g2.y.a,
            hashA, hashB,
            publicKey.x.b, publicKey.x.a, publicKey.y.b, publicKey.y.a
        );
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
            return false;
        }

        return true;
    }
}
