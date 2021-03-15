// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxERC20.sol - SKALE Interchain Messaging Agent
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

import "./PermissionsForMainnet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20 Module For Mainnet
 * @dev Runs on Mainnet, and manages receiving and sending of ERC20 token contracts
 * and encoding contractPosition in DepositBoxERC20.
 */
contract DepositBoxERC20 is PermissionsForMainnet {

    // schainID => address of ERC20 on Mainnet
    mapping(bytes32 => mapping(address => bool)) public schainToERC20;
    mapping(bytes32 => bool) public withoutWhitelist;

    /**
     * @dev Emitted when token is mapped in DepositBoxERC20.
     */
    event ERC20TokenAdded(string schainID, address indexed contractOnMainnet);
    
    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(address indexed contractOnMainnet, uint256 amount);

    /**
     * @dev Allows DepositBox to receive ERC20 tokens.
     * 
     * Emits an {ERC20TokenAdded} event on token mapping in DepositBoxERC20.
     * Emits an {ERC20TokenReady} event.
     * 
     * Requirements:
     * 
     * - Amount must be less than or equal to the total supply of the ERC20 contract.
     */
    function receiveERC20(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        allow("DepositBox")
        returns (bytes memory data)
    {
        uint256 totalSupply = ERC20UpgradeSafe(contractOnMainnet).totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = schainToERC20[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        if (!isERC20AddedToSchain) {
            _addERC20ForSchain(schainID, contractOnMainnet);
            data = _encodeCreateData(contractOnMainnet, to, amount);
            emit ERC20TokenAdded(schainID, contractOnMainnet);
        } else {
            data = _encodeRegularData(contractOnMainnet, to, amount);
        }
        emit ERC20TokenReady(contractOnMainnet, amount);
    }

    /**
     * @dev Allows DepositBox to send ERC20 tokens.
     */
    function sendERC20(bytes calldata data) external allow("DepositBox") returns (bool) {
        address contractOnMainnet;
        address receiver;
        uint256 amount;
        (contractOnMainnet, receiver, amount) = _fallbackDataParser(data);
        return _sendERC20(contractOnMainnet, receiver, amount);
    }

    /**
     * @dev Allows Schain owner to add an ERC20 token to DepositBoxERC20.
     */
    function addERC20TokenByOwner(string calldata schainName, address erc20OnMainnet) external {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(isSchainOwner(msg.sender, schainId) || msg.sender == getOwner(), "Sender is not a Schain owner");
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC20[schainId][erc20OnMainnet] = true;
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
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
     * @dev Returns the receiver address of the ERC20 token.
     */
    function getReceiver(bytes calldata data) external view returns (address receiver) {
        (, receiver, ) = _fallbackDataParser(data);
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }

    /**
     * @dev Allows ERC20Module to add an ERC20 token to DepositBoxERC20.
     */
    function _addERC20ForSchain(string calldata schainName, address erc20OnMainnet) private {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(erc20OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC20[schainId][erc20OnMainnet] = true;
        emit ERC20TokenAdded(schainName, erc20OnMainnet);
    }

    /**
     * @dev Allows ERC20Module to send an ERC20 token from
     * DepositBoxERC20.
     * 
     * Requirements:
     *
     * - `amount` must be less than or equal to the balance
     * in DepositBoxERC20.
     * - Transfer must be successful. 
     */
    function _sendERC20(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        private
        returns (bool)
    {
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        require(IERC20(contractOnMainnet).balanceOf(address(this)) >= amount, "Not enough money");
        require(IERC20(contractOnMainnet).transfer(to, amount), "Something went wrong with `transfer` in ERC20");
        return true;
    }

    /**
     * @dev Returns encoded creation data for ERC20 token.
     */
    function _encodeRegularData(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        private
        view
        returns (bytes memory data)
    {
        uint256 totalSupply = ERC20UpgradeSafe(contractOnMainnet).totalSupply();
        data = abi.encodePacked(
            bytes1(uint8(3)),
            bytes32(bytes20(contractOnMainnet)),
            bytes32(bytes20(to)),
            bytes32(amount),
            totalSupply
        );
    }    

    /**
     * @dev Returns encoded creation data for ERC20 token.
     */
    function _encodeCreateData(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        private
        view
        returns (bytes memory data)
    {
        string memory name = ERC20UpgradeSafe(contractOnMainnet).name();
        uint8 decimals = ERC20UpgradeSafe(contractOnMainnet).decimals();
        string memory symbol = ERC20UpgradeSafe(contractOnMainnet).symbol();
        uint256 totalSupply = ERC20UpgradeSafe(contractOnMainnet).totalSupply();
        data = abi.encodePacked(
            bytes1(uint8(3)),
            bytes32(bytes20(contractOnMainnet)),
            bytes32(bytes20(to)),
            bytes32(amount),
            totalSupply,
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol,
            decimals
        );
    }

    /**
     * @dev Returns fallback data.
     */
    function _fallbackDataParser(bytes memory data)
        private
        pure
        returns (address, address payable, uint256)
    {
        bytes32 contractOnMainnet;
        bytes32 to;
        bytes32 tokenAmount;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractOnMainnet := mload(add(data, 33))
            to := mload(add(data, 65))
            tokenAmount := mload(add(data, 97))
        }
        return (
            address(bytes20(contractOnMainnet)), address(bytes20(to)), uint256(tokenAmount)
        );
    }

}
