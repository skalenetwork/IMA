// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   EthErc20.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/tokens/IEthErc20.sol";


/**
 * @title EthErc20
 * @dev ERC20 token that represents ETH on mainnet.
 */
contract EthErc20 is AccessControlEnumerableUpgradeable, ERC20BurnableUpgradeable, IEthErc20 {

    /**
     * @dev id of a role that allows token minting.
     */
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @dev id of a role that allows token burning.
     */
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /**
     * @dev Mint tokens.
     * 
     * Requirements:
     * 
     * - sender must be granted with {MINTER_ROLE}.
     */
    function mint(address account, uint256 amount) external override {
        require(hasRole(MINTER_ROLE, _msgSender()), "MINTER role is required");
        _mint(account, amount);
    }

    /**
     * @dev Burn tokens for any account.
     * 
     * Requirements:
     * 
     * - sender must be granted with {BURNER_ROLE}.
     */
    function forceBurn(address account, uint256 amount) external override {
        require(hasRole(BURNER_ROLE, _msgSender()), "BURNER role is required");
        _burn(account, amount);
    }

    /**
     * @dev Is called once during contract deployment.
     */
    function initialize(address tokenManagerEthAddress)
        external
        override
        initializer
    {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        ERC20Upgradeable.__ERC20_init("ERC20 Ether Clone", "ETHC");
        ERC20BurnableUpgradeable.__ERC20Burnable_init();        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, tokenManagerEthAddress);
        _setupRole(BURNER_ROLE, tokenManagerEthAddress);
    }
}
