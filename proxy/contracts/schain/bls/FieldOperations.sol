// SPDX-License-Identifier: AGPL-3.0-only

/*
    FieldOperations.sol - SKALE Manager
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

import "@skalenetwork/ima-interfaces/schain/bls/IFieldOperations.sol";

import "./Precompiled.sol";


library Fp2Operations {

    uint constant public P = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    function addFp2(
        IFieldOperations.Fp2Point memory value1,
        IFieldOperations.Fp2Point memory value2
    )
        internal
        pure
        returns (IFieldOperations.Fp2Point memory)
    {
        return IFieldOperations.Fp2Point({ a: addmod(value1.a, value2.a, P), b: addmod(value1.b, value2.b, P) });
    }

    function scalarMulFp2(
        IFieldOperations.Fp2Point memory value,
        uint scalar
    )
        internal
        pure
        returns (IFieldOperations.Fp2Point memory)
    {
        return IFieldOperations.Fp2Point({ a: mulmod(scalar, value.a, P), b: mulmod(scalar, value.b, P) });
    }

    function minusFp2(
        IFieldOperations.Fp2Point memory diminished,
        IFieldOperations.Fp2Point memory subtracted
    )
        internal
        pure
        returns (IFieldOperations.Fp2Point memory difference)
    {
        uint p = P;
        if (diminished.a >= subtracted.a) {
            difference.a = addmod(diminished.a, p - subtracted.a, p);
        } else {
            difference.a = (p - addmod(subtracted.a, p - diminished.a, p)) % p;
        }
        if (diminished.b >= subtracted.b) {
            difference.b = addmod(diminished.b, p - subtracted.b, p);
        } else {
            difference.b = (p - addmod(subtracted.b, p - diminished.b, p)) % p;
        }
    }

    function mulFp2(
        IFieldOperations.Fp2Point memory value1,
        IFieldOperations.Fp2Point memory value2
    )
        internal
        pure
        returns (IFieldOperations.Fp2Point memory result)
    {
        uint p = P;
        IFieldOperations.Fp2Point memory point = IFieldOperations.Fp2Point({
            a: mulmod(value1.a, value2.a, p),
            b: mulmod(value1.b, value2.b, p)});
        result.a = addmod(
            point.a,
            mulmod(p - 1, point.b, p),
            p);
        result.b = addmod(
            mulmod(
                addmod(value1.a, value1.b, p),
                addmod(value2.a, value2.b, p),
                p),
            p - addmod(point.a, point.b, p),
            p);
    }

    function squaredFp2(
        IFieldOperations.Fp2Point memory value
    )
        internal
        pure
        returns (IFieldOperations.Fp2Point memory)
    {
        uint p = P;
        uint ab = mulmod(value.a, value.b, p);
        uint mult = mulmod(addmod(value.a, value.b, p), addmod(value.a, mulmod(p - 1, value.b, p), p), p);
        return IFieldOperations.Fp2Point({ a: mult, b: addmod(ab, ab, p) });
    }

    function isEqual(
        IFieldOperations.Fp2Point memory value1,
        IFieldOperations.Fp2Point memory value2
    )
        internal
        pure
        returns (bool)
    {
        return value1.a == value2.a && value1.b == value2.b;
    }
}

library G1Operations {
    using Fp2Operations for IFieldOperations.Fp2Point;

    function getG1Generator() internal pure returns (IFieldOperations.Fp2Point memory) {
        // Current solidity version does not support Constants of non-value type
        // so we implemented this function
        return IFieldOperations.Fp2Point({
            a: 1,
            b: 2
        });
    }

    function isG1Point(uint x, uint y) internal pure returns (bool) {
        uint p = Fp2Operations.P;
        return mulmod(y, y, p) == 
            addmod(mulmod(mulmod(x, x, p), x, p), 3, p);
    }

    function isG1(IFieldOperations.Fp2Point memory point) internal pure returns (bool) {
        return isG1Point(point.a, point.b);
    }

    function checkRange(IFieldOperations.Fp2Point memory point) internal pure returns (bool) {
        return point.a < Fp2Operations.P && point.b < Fp2Operations.P;
    }

    function negate(uint y) internal pure returns (uint) {
        return (Fp2Operations.P - y) % Fp2Operations.P;
    }

}


library G2Operations {
    using Fp2Operations for IFieldOperations.Fp2Point;

    function getTWISTB() internal pure returns (IFieldOperations.Fp2Point memory) {
        // Current solidity version does not support Constants of non-value type
        // so we implemented this function
        return IFieldOperations.Fp2Point({
            a: 19485874751759354771024239261021720505790618469301721065564631296452457478373,
            b: 266929791119991161246907387137283842545076965332900288569378510910307636690
        });
    }

    function getG2Generator() internal pure returns (IFieldOperations.G2Point memory) {
        // Current solidity version does not support Constants of non-value type
        // so we implemented this function
        return IFieldOperations.G2Point({
            x: IFieldOperations.Fp2Point({
                a: 10857046999023057135944570762232829481370756359578518086990519993285655852781,
                b: 11559732032986387107991004021392285783925812861821192530917403151452391805634
            }),
            y: IFieldOperations.Fp2Point({
                a: 8495653923123431417604973247489272438418190587263600148770280649306958101930,
                b: 4082367875863433681332203403145435568316851327593401208105741076214120093531
            })
        });
    }

    function getG2Zero() internal pure returns (IFieldOperations.G2Point memory) {
        // Current solidity version does not support Constants of non-value type
        // so we implemented this function
        return IFieldOperations.G2Point({
            x: IFieldOperations.Fp2Point({
                a: 0,
                b: 0
            }),
            y: IFieldOperations.Fp2Point({
                a: 1,
                b: 0
            })
        });
    }

    function isG2Point(
        IFieldOperations.Fp2Point memory x,
        IFieldOperations.Fp2Point memory y
    )
        internal
        pure
        returns (bool)
    {
        if (isG2ZeroPoint(x, y)) {
            return true;
        }
        IFieldOperations.Fp2Point memory squaredY = y.squaredFp2();
        IFieldOperations.Fp2Point memory res = squaredY.minusFp2(
                x.squaredFp2().mulFp2(x)
            ).minusFp2(getTWISTB());
        return res.a == 0 && res.b == 0;
    }

    function isG2(IFieldOperations.G2Point memory value) internal pure returns (bool) {
        return isG2Point(value.x, value.y);
    }

    function isG2ZeroPoint(
        IFieldOperations.Fp2Point memory x,
        IFieldOperations.Fp2Point memory y
    )
        internal
        pure
        returns (bool)
    {
        return x.a == 0 && x.b == 0 && y.a == 1 && y.b == 0;
    }

    function isG2Zero(IFieldOperations.G2Point memory value) internal pure returns (bool) {
        return value.x.a == 0 && value.x.b == 0 && value.y.a == 1 && value.y.b == 0;
    }

    function isEqual(
        IFieldOperations.G2Point memory value1,
        IFieldOperations.G2Point memory value2
    )
        internal
        pure
        returns (bool)
    {
        return value1.x.isEqual(value2.x) && value1.y.isEqual(value2.y);
    }
}