// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   LockAndDataForMainnetERC20.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./PermissionsForMainnet.sol";


/**
 * @title Lock and Data For Mainnet ERC20
 * @dev Runs on Mainnet, holds deposited ERC20s, and contains mappings and
 * balances of ERC20 tokens received through DepositBox.
 */
contract LockAndDataForMainnetERC20 is PermissionsForMainnet {

    // schainID => address of ERC20 on Mainnet
    mapping(bytes32 => mapping(address => bool)) public schainToERC20;
    mapping(bytes32 => bool) public withoutWhitelist;

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC20.
     */
    event ERC20TokenAdded(address indexed tokenHere, string schainID);

    /**
     * @dev Allows ERC20Module to send an ERC20 token from
     * LockAndDataForMainnetERC20.
     * 
     * Requirements:
     *
     * - `amount` must be less than or equal to the balance
     * in LockAndDataForMainnetERC20.
     * - Transfer must be successful. 
     */
    function sendERC20(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        allow("ERC20Module")
        returns (bool)
    {
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        require(IERC20(contractOnMainnet).balanceOf(address(this)) >= amount, "Not enough money");
        require(IERC20(contractOnMainnet).transfer(to, amount), "Something went wrong with `transfer` in ERC20");
        return true;
    }

    /**
     * @dev Allows ERC20Module to add an ERC20 token to LockAndDataForMainnetERC20.
     */
    function addERC20ForSchain(string calldata schainName, address erc20OnMainnet) external allow("ERC20Module") {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC20[schainId][erc20OnMainnet] = true;
        emit ERC20TokenAdded(erc20OnMainnet, schainName);
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to LockAndDataForMainnetERC20.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet) external {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(isSchainOwner(msg.sender, schainId) || msg.sender == getOwner(), "Sender is not a Schain owner");
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC20[schainId][erc20OnMainnet] = true;
        emit ERC20TokenAdded(erc20OnMainnet, schainName);
    }

    /**
     * @dev Allows Schain owner turn on whitelist of tokens.
     */
    function enableWhitelist(string memory schainName) external {
        require(isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))), "Sender is not a Schain owner");
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = false;
    }

    /**
     * @dev Allows Schain owner turn off whitelist of tokens.
     */
    function disableWhitelist(string memory schainName) external {
        require(isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))), "Sender is not a Schain owner");
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = true;
    }

    /**
     * @dev Should return true if token in whitelist.
     */
    function getSchainToERC20(string calldata schainName, address erc20OnMainnet) external view returns (bool) {
        return schainToERC20[keccak256(abi.encodePacked(schainName))][erc20OnMainnet];
    }

    /**
     * @dev constructor
     */
    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }
}
