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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Metadata.sol";

import "./LockAndDataForMainnetERC721.sol";
import "./Messages.sol";
import "./PermissionsForMainnet.sol";


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
        address lockAndDataERC721 = IContractManager(lockAndDataAddress_).getContract(
            "LockAndDataERC721"
        );
        bool isERC721AddedToSchain = LockAndDataForMainnetERC721(lockAndDataERC721)
            .getSchainToERC721(schainID, contractOnMainnet);
        if (!isERC721AddedToSchain) {
            LockAndDataForMainnetERC721(lockAndDataERC721).addERC721ForSchain(schainID, contractOnMainnet);
            emit ERC721TokenAdded(schainID, contractOnMainnet);
        }
        data = Messages.encodeTransferErc721AndTokenInfoMessage(
            contractOnMainnet,
            to,
            tokenId,
            _getTokenInfo(IERC721Metadata(contractOnMainnet))
        );
        emit ERC721TokenReady(contractOnMainnet, tokenId);
    }

    /**
     * @dev Allows DepositBox to send ERC721 tokens.
     */
    function sendERC721(bytes calldata data) external allow("DepositBox") returns (bool) {
        address lockAndDataERC721 = IContractManager(lockAndDataAddress_).getContract(
            "LockAndDataERC721"
        );
        Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
        return LockAndDataForMainnetERC721(lockAndDataERC721)
            .sendERC721(message.token, message.receiver, message.tokenId);
    }

    /**
     * @dev Returns the receiver address of the ERC721 token.
     */
    function getReceiver(bytes calldata data) external view returns (address) {
        return Messages.decodeTransferErc721Message(data).receiver;
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }

    function _getTokenInfo(IERC721Metadata erc721) internal view returns (Messages.Erc721TokenInfo memory) {
        return Messages.Erc721TokenInfo({
            name: erc721.name(),
            symbol: erc721.symbol()
        });
    }
}
