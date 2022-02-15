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


/**
 * @title Fp2Operations
 * @dev This library contains operations of field that is an extension by imaginary unit of 
 * a field of division remainders of a prime number
 * 
 * Element of field is Fp2Point
 * 
 * Prime divisor is P
 * 
 * Defined operations:
 * 
 * - addition
 * - subtraction
 * - scalar multiplication
 * - multiplication
 * - squaring
 * - comparison for equality
 */
library Fp2Operations {

    /**
     * @dev Prime devisor
     */
    uint constant public P = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    /**
     * @dev Add {value1} to {value2}
     */
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

    /**
     * @dev Perform scalar multiplication of {value} by {scalar}
     */
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

    /**
     * @dev Subtract {subtracted} from {diminished}
     */
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

    /**
     * @dev Multiply {value1} by {value2}
     */
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

    /**
     * @dev Square {value}
     */
    function squaredFp2(
        IFieldOperations.Fp2Point memory value
    )
        internal
        pure
        returns (IFieldOperations.Fp2Point memory)
    {
        uint p = P;
        uint ab = mulmod(value.a, value.b, p);
        uint multiplication = mulmod(addmod(value.a, value.b, p), addmod(value.a, mulmod(p - 1, value.b, p), p), p);
        return IFieldOperations.Fp2Point({ a: multiplication, b: addmod(ab, ab, p) });
    }

    /**
     * @dev Check if {value1} is equal to {value2}
     */
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

/**
 * @title G1Operations
 * @dev This library contains operations of a group of elements {x, y}
 * where y^2 = x^3 + 3 mod P and (x + iy) is an element of Fp2
 * 
 * Element of the group is Fp2Point
 * 
 * Prime divisor is Fp2Operations.P
 * 
 * A group generator is {1, 2}
 * 
 * Defined operations:
 * 
 * - check if a point is in the group G1
 * - check if a point is in the field Fp2
 * - for x of Fp calculate -x
 */
library G1Operations {
    using Fp2Operations for IFieldOperations.Fp2Point;

    /**
     * @dev Get G1 group generator
     */
    function getG1Generator() internal pure returns (IFieldOperations.Fp2Point memory) {
        // Current solidity version does not support Constants of non-value type
        // so we implemented this function
        return IFieldOperations.Fp2Point({
            a: 1,
            b: 2
        });
    }

    /**
     * @dev Check if ({x], {y}) is a G1 element
     */
    function isG1Point(uint x, uint y) internal pure returns (bool) {
        uint p = Fp2Operations.P;
        return mulmod(y, y, p) == 
            addmod(mulmod(mulmod(x, x, p), x, p), 3, p);
    }

    /**
     * @dev Check if {point} is a G1 element
     */
    function isG1(IFieldOperations.Fp2Point memory point) internal pure returns (bool) {
        return isG1Point(point.a, point.b);
    }

    /**
     * @dev Check if {point} is a Fp2 element
     */
    function checkRange(IFieldOperations.Fp2Point memory point) internal pure returns (bool) {
        return point.a < Fp2Operations.P && point.b < Fp2Operations.P;
    }

    /**
     * @dev For {y} of Fp calculate -y
     */
    function negate(uint y) internal pure returns (uint) {
        return (Fp2Operations.P - y) % Fp2Operations.P;
    }

}

/**
 * @title G2Operations
 * @dev This library contains operations of a group of elements {x, y}
 * where y^2 = x^3 + TWISTB and x and y are elements of Fp2
 * 
 * Element of the group is G2Point
 * 
 * Prime divisor is Fp2Operations.P
 * TWISTB is
 * {
 *     19485874751759354771024239261021720505790618469301721065564631296452457478373,
 *     266929791119991161246907387137283842545076965332900288569378510910307636690
 * }
 * A group generator is
 * {
 *     {
 *         10857046999023057135944570762232829481370756359578518086990519993285655852781,
 *         11559732032986387107991004021392285783925812861821192530917403151452391805634
 *     },
 *     {
 *         8495653923123431417604973247489272438418190587263600148770280649306958101930,
 *         4082367875863433681332203403145435568316851327593401208105741076214120093531
 *     }
 * }
 * 
 * Defined operations:
 * 
 * - check if a point is in the group G2
 * - check if a point is zero element of group G2
 * - comparison for equality
 */
library G2Operations {
    using Fp2Operations for IFieldOperations.Fp2Point;


    /**
     * @dev Get value of TWISTB
     */
    function getTWISTB() internal pure returns (IFieldOperations.Fp2Point memory) {
        // Current solidity version does not support Constants of non-value type
        // so we implemented this function
        return IFieldOperations.Fp2Point({
            a: 19485874751759354771024239261021720505790618469301721065564631296452457478373,
            b: 266929791119991161246907387137283842545076965332900288569378510910307636690
        });
    }

    /**
     * @dev Get G2 group generator
     */
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

    /**
     * @dev Get G2 zero element
     */
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

    /**
     * @dev Check if ({x}, {y}) is an element of G2
     */
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

    /**
     * @dev Check if {value} is an element of G2
     */
    function isG2(IFieldOperations.G2Point memory value) internal pure returns (bool) {
        return isG2Point(value.x, value.y);
    }

    /**
     * @dev Check if ({x}, {y}) is a zero element of G2
     */
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

    /**
     * @dev Check if {value} is a zero element of G2
     */
    function isG2Zero(IFieldOperations.G2Point memory value) internal pure returns (bool) {
        return value.x.a == 0 && value.x.b == 0 && value.y.a == 1 && value.y.b == 0;
    }

    /**
     * @dev Check if {value1} is equal to {value2}
     */
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
