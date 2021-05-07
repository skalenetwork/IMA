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

import "./tokens/ERC20OnChain.sol";
import "./tokens/ERC721OnChain.sol";
import "./ContractsRegistry.sol";


contract TokenFactory is ContractsRegistry {

    constructor() public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createERC20(string memory name, string memory symbol)
        external
        allow("TokenManagerERC20")
        returns (ERC20OnChain)
    {
        ERC20OnChain newERC20 = new ERC20OnChain(
            name,
            symbol
        );
        newERC20.grantRole(newERC20.MINTER_ROLE(), getContract("TokenManagerERC20"));
        newERC20.revokeRole(newERC20.MINTER_ROLE(), address(this));
        return newERC20;
    }

    function createERC721(string memory name, string memory symbol)
        external
        allow("TokenManagerERC721")
        returns (ERC721OnChain)
    {
        ERC721OnChain newERC721 = new ERC721OnChain(name, symbol);
        newERC721.grantRole(newERC721.MINTER_ROLE(), getContract("TokenManagerERC721"));
        newERC721.revokeRole(newERC721.MINTER_ROLE(), address(this));
        return newERC721;
    }
}