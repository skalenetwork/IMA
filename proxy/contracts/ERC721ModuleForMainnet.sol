// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721ModuleForMainnet.sol - SKALE Interchain Messaging Agent
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
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Metadata.sol";

interface ILockAndDataERC721M {
    function getSchainToERC721(string calldata schainID, address erc721OnMainnet) external view returns (bool);
    function sendERC721(address contractOnMainnet, address to, uint256 token) external returns (bool);
    function addERC721ForSchain(string calldata schainID, address erc721OnMainnet) external;
}

/**
 * @title ERC721 Module For Mainnet
 * @dev Runs on Mainnet, and manages receiving and sending of ERC721 token contracts
 * and encoding contractPosition in LockAndDataForMainnetERC721.
 */
contract ERC721ModuleForMainnet is PermissionsForMainnet {

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC721.
     */
    event ERC721TokenAdded(string schainID, address indexed contractOnMainnet);
    event ERC721TokenReady(address indexed contractOnMainnet, uint256 tokenId);

    /**
     * @dev Allows DepositBox to receive ERC721 tokens.
     * 
     * Emits an {ERC721TokenAdded} event.  
     */
    function receiveERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
        allow("DepositBox")
        returns (bytes memory data)
    {
        address lockAndDataERC721 = IContractManagerForMainnet(lockAndDataAddress_).permitted(
            keccak256(abi.encodePacked("LockAndDataERC721"))
        );
         bool isERC721AddedToSchain= ILockAndDataERC721M(lockAndDataERC721).getSchainToERC721(schainID, contractOnMainnet);
        if (!isERC721AddedToSchain) {
            ILockAndDataERC721M(lockAndDataERC721).addERC721ForSchain(schainID, contractOnMainnet);
            emit ERC721TokenAdded(schainID, contractOnMainnet);
        }
        data = _encodeData(contractOnMainnet, to, tokenId);
        // else {
        //     data = _encodeRawData(to, tokenId);
        //     return data;
        // }
        emit ERC721TokenReady(contractOnMainnet, tokenId);
    }

    /**
     * @dev Allows DepositBox to send ERC721 tokens.
     */
    function sendERC721(bytes calldata data) external allow("DepositBox") returns (bool) {
        address lockAndDataERC721 = IContractManagerForMainnet(lockAndDataAddress_).permitted(
            keccak256(abi.encodePacked("LockAndDataERC721"))
        );
        address contractOnMainnet;
        address receiver;
        uint256 tokenId;
        (contractOnMainnet, receiver, tokenId) = _fallbackDataParser(data);
        return ILockAndDataERC721M(lockAndDataERC721).sendERC721(contractOnMainnet, receiver, tokenId);
    }

    /**
     * @dev Returns the receiver address of the ERC721 token.
     */
    function getReceiver(bytes calldata data) external pure returns (address receiver) {
        (, receiver, ) = _fallbackDataParser(data);
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }

    /**
     * @dev Returns encoded creation data for ERC721 token.
     */
    function _encodeData(
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        private
        view
        returns (bytes memory data)
    {
        string memory name = IERC721Metadata(contractOnMainnet).name();
        string memory symbol = IERC721Metadata(contractOnMainnet).symbol();
        data = abi.encodePacked(
            bytes1(uint8(5)),
            bytes32(bytes20(contractOnMainnet)),
            bytes32(bytes20(to)),
            bytes32(tokenId),
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol
        );
    }

    // /**
    //  * @dev Returns encoded regular data.
    //  */
    // function _encodeRawData(address to, uint256 tokenId) private pure returns (bytes memory data) {
    //     data = abi.encodePacked(
    //         bytes1(uint8(21)),
    //         bytes32(bytes20(to)),
    //         bytes32(tokenId)
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
        bytes32 token;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractOnMainnet := mload(add(data, 33))
            to := mload(add(data, 65))
            token := mload(add(data, 97))
        }
        return (
            address(bytes20(contractOnMainnet)), address(bytes20(to)), uint256(token)
        );
    }

    // /**
    //  * @dev Returns fallback raw data.
    //  */
    // function _fallbackRawDataParser(bytes memory data)
    //     private
    //     pure
    //     returns (address payable, uint256)
    // {
    //     bytes32 to;
    //     bytes32 token;
    //     // solhint-disable-next-line no-inline-assembly
    //     assembly {
    //         to := mload(add(data, 33))
    //         token := mload(add(data, 65))
    //     }
    //     return (address(bytes20(to)), uint256(token));
    // }

}
