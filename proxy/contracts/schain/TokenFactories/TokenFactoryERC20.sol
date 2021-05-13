// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenFactory.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
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

import "../tokens/ERC20OnChain.sol";
import "../TokenFactory.sol";


contract TokenFactoryERC20 is TokenFactory {

    constructor(string memory newTokenManagerERC20Name, address newTokenManagerERC20Address)
        public
        TokenFactory(newTokenManagerERC20Name, newTokenManagerERC20Address)
        // solhint-disable-next-line no-empty-blocks
    { }

    function createERC20(string memory name, string memory symbol)
        external
        onlyTokenManager
        returns (ERC20OnChain)
    {
        ERC20OnChain newERC20 = new ERC20OnChain(
            name,
            symbol
        );
        newERC20.grantRole(newERC20.MINTER_ROLE(), getTokenManager());
        newERC20.revokeRole(newERC20.MINTER_ROLE(), address(this));
        return newERC20;
    }
}