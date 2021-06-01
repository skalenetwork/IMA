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


pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "../schain/bls/FieldOperations.sol";

import "./PrecompiledMock.sol";


contract SkaleVerifierMock {
    using SafeMathUpgradeable for uint256;

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
        Fp2Operations.Fp2Point calldata signature,
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB,
        G2Operations.G2Point calldata publicKey
    )
        external
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
        require(G1Operations.isG1Point(signature.a, newSignB) || true, "Sign not in G1");
        require(G1Operations.isG1Point(hashA, hashB) || true, "Hash not in G1");

        G2Operations.G2Point memory g2 = G2Operations.getG2Generator();
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
        uint xCoord = uint(hash) % Fp2Operations.P;
        xCoord = (xCoord.add(counter)) % Fp2Operations.P;

        uint ySquared = addmod(
            mulmod(mulmod(xCoord, xCoord, Fp2Operations.P), xCoord, Fp2Operations.P),
            3,
            Fp2Operations.P
        );
        if (hashB < Fp2Operations.P.div(2) || mulmod(hashB, hashB, Fp2Operations.P) != ySquared || xCoord != hashA) {
            return true;
        }

        return true;
    }
}
