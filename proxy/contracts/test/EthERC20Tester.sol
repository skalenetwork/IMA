// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   EthERC20Tester.sol - SKALE Interchain Messaging Agent
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

import "../schain/tokens/EthERC20.sol";


contract EthERC20Tester is EthERC20 {

    constructor(address tokenManagerEthAddress) EthERC20(tokenManagerEthAddress) public {

    }

    function setTokenManagerEthAddress(address newTokenManagerEthAddress) public {
        tokenManagerEth = newTokenManagerEthAddress;
    }
}