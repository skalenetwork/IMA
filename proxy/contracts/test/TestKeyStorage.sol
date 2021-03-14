// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TestKeyStorage.sol - SKALE Interchain Messaging Agent
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


pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./TestFieldOperations.sol";


contract KeyStorage {

    mapping(bytes32 => G2Operations.G2Point) private _schainsPublicKeys;

    function setCommonPublicKey(bytes32 schainId, G2Operations.G2Point memory value) external {
        _schainsPublicKeys[schainId] = value;
    }

    function getCommonPublicKey(bytes32 schainId) external view returns (G2Operations.G2Point memory) {
        return _schainsPublicKeys[schainId];
    }
}
