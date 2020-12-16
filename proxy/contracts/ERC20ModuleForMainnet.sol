// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC20ModuleForMainnet.sol - SKALE Interchain Messaging Agent
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

interface ILockAndDataERC20M {
    function sendERC20(address contractOnMainnet, address to, uint256 amount) external returns (bool);
    function addERC20ForSchain(string calldata schainID, address erc20OnMainnet) external;
    function getSchainToERC20(string calldata schainID, address erc20OnMainnet) external view returns (bool);
}

/**
 * @title ERC20 Module For Mainnet
 * @dev Runs on Mainnet, and manages receiving and sending of ERC20 token contracts
 * and encoding contractPosition in LockAndDataForMainnetERC20.
 */
contract ERC20ModuleForMainnet is PermissionsForMainnet {

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC20.
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
     * Emits an {ERC20TokenAdded} event on token mapping in LockAndDataForMainnetERC20.
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
        address lockAndDataERC20 = IContractManagerForMainnet(lockAndDataAddress_).permitted(
            keccak256(abi.encodePacked("LockAndDataERC20"))
        );
        uint256 totalSupply = ERC20UpgradeSafe(contractOnMainnet).totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = ILockAndDataERC20M(lockAndDataERC20).getSchainToERC20(schainID, contractOnMainnet);
        if (!isERC20AddedToSchain) {
            ILockAndDataERC20M(lockAndDataERC20).addERC20ForSchain(schainID, contractOnMainnet);
            emit ERC20TokenAdded(schainID, contractOnMainnet);
        } 
        data = _encodeData(contractOnMainnet, to, amount);
        // else {
        //     data = _encodeRegularData(contractOnMainnet, to, amount);
        // }
        emit ERC20TokenReady(contractOnMainnet, amount);
    }

    /**
     * @dev Allows DepositBox to send ERC20 tokens.
     */
    function sendERC20(bytes calldata data) external allow("DepositBox") returns (bool) {
        address lockAndDataERC20 = IContractManagerForMainnet(lockAndDataAddress_).permitted(
            keccak256(abi.encodePacked("LockAndDataERC20"))
        );
        address contractOnMainnet;
        address receiver;
        uint256 amount;
        (contractOnMainnet, receiver, amount) = _fallbackDataParser(data);
        return ILockAndDataERC20M(lockAndDataERC20).sendERC20(contractOnMainnet, receiver, amount);
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
     * @dev Returns encoded creation data for ERC20 token.
     */
    function _encodeData(
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
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol,
            decimals,
            totalSupply
        );
    }

    // /**
    //  * @dev Returns encoded regular data.
    //  */
    // function _encodeRegularData(
    //     address contractHere,
    //     address to,
    //     uint256 amount
    // )
    //     private
    //     pure
    //     returns (bytes memory data)
    // {
    //     data = abi.encodePacked(
    //         bytes1(uint8(19)),
    //         bytes32(bytes20(contractHere)),
    //         bytes32(bytes20(to)),
    //         bytes32(amount)
    //     );
    // }

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
