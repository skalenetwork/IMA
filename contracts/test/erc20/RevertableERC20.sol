// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   RevertableERC20.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2022-Present SKALE Labs
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

pragma solidity 0.8.27;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

interface IRevertableERC20 {
    function enable() external;
    function disable() external;
    function mint(address account, uint amount) external;
}

contract RevertableERC20 is IRevertableERC20, ERC20Upgradeable {
    bool public enabled = true;

    constructor(string memory name, string memory symbol) initializer {
        super.__ERC20_init(name, symbol);
    }

    function enable() external override {
        enabled = true;
    }

    function disable() external override {
        enabled = false;
    }

    function mint(address account, uint amount) external override {
        _mint(account, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    )
        internal
        override
    {
        require(enabled, "Transfers are disabled");
        super._transfer(from, to, amount);
    }
}
