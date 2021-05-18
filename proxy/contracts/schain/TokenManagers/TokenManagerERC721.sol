// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../../Messages.sol";
import "../tokens/ERC721OnChain.sol";
import "../TokenManager.sol";


/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract TokenManagerERC721 is TokenManager {

    // address of ERC721 on Mainnet => ERC721 on Schain
    mapping(address => ERC721OnChain) public clonesErc721;

    event ERC721TokenAdded(address indexed erc721OnMainnet, address indexed erc721OnSchain);

    event ERC721TokenCreated(address indexed erc721OnMainnet, address indexed erc721OnSchain);

    event ERC721TokenReceived(address indexed erc721OnMainnet, address indexed erc721OnSchain, uint256 tokenId);

    constructor(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        CommunityLocker newCommunityLocker,
        address newDepositBox
    )
        public
        TokenManager(newChainName, newMessageProxy, newIMALinker, newCommunityLocker, newDepositBox)
        // solhint-disable-next-line no-empty-blocks
    { }    

    function exitToMainERC721(
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
    {
        require(to != address(0), "Incorrect receiver address");
        ERC721Burnable contractOnSchain = clonesErc721[contractOnMainnet];
        getCommunityLocker().checkAllowedToSendMessage(to);
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.getApproved(tokenId) == address(this), "Not allowed ERC721 Token");
        contractOnSchain.transferFrom(msg.sender, address(this), tokenId);
        contractOnSchain.burn(tokenId);
        bytes memory data = Messages.encodeTransferErc721Message(contractOnMainnet, to, tokenId);
        getMessageProxy().postOutgoingMessage(MAINNET_NAME, getDepositBoxERC721Address(), data);
    }

    function transferToSchainERC721(
        string calldata targetSchainName,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    ) 
        external
    {
        require(to != address(0), "Incorrect receiver address");
        bytes32 targetSchainId = keccak256(abi.encodePacked(targetSchainName));
        require(
            targetSchainId != MAINNET_ID,
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagers[targetSchainId] != address(0), "Incorrect Token Manager address");
        ERC721Burnable contractOnSchain = clonesErc721[contractOnMainnet];
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.getApproved(tokenId) == address(this), "Not allowed ERC721 Token");
        contractOnSchain.transferFrom(msg.sender, address(this), tokenId);
        contractOnSchain.burn(tokenId);
        bytes memory data = Messages.encodeTransferErc721Message(contractOnMainnet, to, tokenId);    
        getMessageProxy().postOutgoingMessage(targetSchainName, tokenManagers[targetSchainId], data);
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     * 
     * Emits an {Error} event upon failure.
     *
     * Requirements:
     * 
     * - MessageProxy must be the sender.
     * - `fromSchainID` must exist in TokenManager addresses.
     */
    function postMessage(
        bytes32 fromChainId,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        returns (bool)
    {
        require(
            fromChainId != getSchainHash() && 
            (
                fromChainId == MAINNET_ID ?
                sender == getDepositBoxERC721Address() :
                sender == tokenManagers[fromChainId]
            ),
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        if (
            operation == Messages.MessageType.TRANSFER_ERC721_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC721
        ) {
            _sendERC721(data);
        } else {
            revert("MessageType is unknown");
        }
        return true;
    }

    /**
     * @dev Allows Schain owner to add an ERC721 token to LockAndDataForSchainERC721.
     */
    function addERC721TokenByOwner(
        address erc721OnMainnet,
        ERC721OnChain erc721OnSchain
    )
        external
    {
        require(_isSchainOwner(msg.sender), "Sender is not an Schain owner");
        require(
            address(erc721OnSchain).isContract(),
            "Given address is not a contract"
        );
        clonesErc721[erc721OnMainnet] = erc721OnSchain;
        emit ERC721TokenAdded(erc721OnMainnet, address(erc721OnSchain));
    }

    function getDepositBoxERC721Address() public view returns (address) {
        if (depositBox == address(0)) {
            return getSkaleFeatures().getConfigVariableAddress("skaleConfig.contractSettings.IMA.DepositBoxERC721");
        }
        return depositBox;
    }


    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *  
     * Emits a {ERC721TokenCreated} event if to address = 0.
     */
    function _sendERC721(bytes calldata data) private {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 tokenId;
        if (messageType == Messages.MessageType.TRANSFER_ERC721){
            Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
            receiver = message.receiver;
            token = message.token;
            tokenId = message.tokenId;
        } else {
            Messages.TransferErc721AndTokenInfoMessage memory message =
                Messages.decodeTransferErc721AndTokenInfoMessage(data);
            receiver = message.baseErc721transfer.receiver;
            token = message.baseErc721transfer.token;
            tokenId = message.baseErc721transfer.tokenId;
            ERC721OnChain contractOnSchainTmp = clonesErc721[token];
            if (address(contractOnSchainTmp) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchainTmp = new ERC721OnChain(message.tokenInfo.name, message.tokenInfo.symbol);           
                clonesErc721[token] = contractOnSchainTmp;
                emit ERC721TokenCreated(token, address(contractOnSchainTmp));
            }
        }
        ERC721OnChain contractOnSchain = clonesErc721[token];
        require(address(contractOnSchain).isContract(), "Given address is not a contract");
        contractOnSchain.mint(receiver, tokenId);
        emit ERC721TokenReceived(token, address(contractOnSchain), tokenId);
    }    

}
