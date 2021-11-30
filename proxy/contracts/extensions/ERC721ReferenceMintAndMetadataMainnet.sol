// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721ReferenceMintAndMetadataMainnet.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
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

import "@skalenetwork/ima-interfaces/extensions/IERC721ReferenceMintAndMetadataMainnet.sol";

import "../schain/tokens/ERC721OnChain.sol";
import "./interfaces/MessageReceiver.sol";


// This contract runs on the main net and accepts deposits
contract ERC721ReferenceMintAndMetadataMainnet is MessageReceiver, IERC721ReferenceMintAndMetadataMainnet {

    address public erc721ContractOnMainnet;
    address public senderContractOnSchain;
    string public schainName;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Sender is not an owner");
        _;
    }

    constructor(
        address newMessageProxyAddress,
        address newErc721Contract,
        string memory newSchainName
    )
        MessageProxyClient(newMessageProxyAddress)
    {
        require(newErc721Contract != address(0), "ERC721 contract has to be set");
        erc721ContractOnMainnet = newErc721Contract;
        schainName = newSchainName;
        owner = msg.sender;
    }

    function setSenderContractOnSchain(address newSenderContractOnSchain) external override onlyOwner {
        require(newSenderContractOnSchain != address(0), "Sender contract has to be set");
        senderContractOnSchain = newSenderContractOnSchain;
    }

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        returns (address)
    {
        require(schainHash == keccak256(abi.encodePacked(schainName)), "Incorrect name of schain");
        require(sender == senderContractOnSchain, "Incorrect sender contract");
        address to;
        uint256 tokenId;
        string memory tokenURI;
        (to, tokenId, tokenURI) = abi.decode(data, (address, uint256, string));
        ERC721OnChain(erc721ContractOnMainnet).mint(address(this), tokenId);
        require(
            ERC721OnChain(erc721ContractOnMainnet).setTokenURI(tokenId, tokenURI),
            "Token URI was not set"
        );
        ERC721OnChain(erc721ContractOnMainnet).transferFrom(address(this), to, tokenId);
        return address(0);
    }
}
