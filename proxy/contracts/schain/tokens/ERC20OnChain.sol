// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC20OnChain.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Artem Payvin
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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/tokens/IERC20OnChain.sol";


/**
 * @title ERC20OnChain
 * @dev ERC20 token that is used as an automatically deployed clone of ERC20 on mainnet.
 */
contract ERC20OnChain is AccessControlEnumerableUpgradeable, ERC20BurnableUpgradeable, IERC20OnChain {

    /**
     * @dev id of a role that allows token minting.
     */
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory contractName,
        string memory contractSymbol
    ) initializer
    {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        ERC20Upgradeable.__ERC20_init(contractName, contractSymbol);
        ERC20BurnableUpgradeable.__ERC20Burnable_init();
        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE);
        _setupRole(MINTER_ROLE, _msgSender());
    }

    /**
     * @dev Mint tokens.
     * 
     * Requirements:
     * 
     * - sender must be granted with {MINTER_ROLE}.
     */
    function mint(address account, uint256 value) external override {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mint(account, value);
    }
}
