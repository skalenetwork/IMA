// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IDepositBox.sol - Interface of DepositBox Template Contract
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

interface IDepositBox {

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        returns (bool);

    function addTokenManager(string calldata schainID, address newTokenManagerAddress) external;

    function removeTokenManager(string calldata schainID) external;

    function hasTokenManager(string calldata schainID) external view returns (bool);
}
