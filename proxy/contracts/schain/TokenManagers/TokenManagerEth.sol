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

import "../../Messages.sol";
import "../tokens/EthErc20.sol";
import "../TokenManager.sol";


/**
 * This contract runs on schains and accepts messages from main net creates ETH clones.
 * When the user exits, it burns them
 */

/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract TokenManagerEth is TokenManager {

    EthErc20 public ethErc20;

    /// Create a new token manager    

    function setEthErc20Address(EthErc20 newEthErc20Address) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        require(ethErc20 != newEthErc20Address, "The same address");
        ethErc20 = newEthErc20Address;
    }

    /**
     * @dev Performs an exit (post outgoing message) to Mainnet.
     */
    function exitToMain(address to, uint256 amount) external {
        communityLocker.checkAllowedToSendMessage(to);
        _exit(MAINNET_HASH, depositBox, to, amount);
    }

    function transferToSchain(
        string memory targetSchainName,
        address to,
        uint256 amount
    )
        external
        rightTransaction(targetSchainName, to)
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        _exit(targetSchainHash, tokenManagers[targetSchainHash], to, amount);
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
     * - `fromSchainName` must exist in TokenManager addresses.
     */
    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        checkReceiverChain(fromChainHash, sender)
        returns (address)
    {
        Messages.TransferEthMessage memory decodedMessage = Messages.decodeTransferEthMessage(data);
        address receiver = decodedMessage.receiver;
        require(receiver != address(0), "Incorrect receiver");
        ethErc20.mint(receiver, decodedMessage.amount);
        return receiver;
    }

    function initialize(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        CommunityLocker newCommunityLocker,
        address newDepositBox,
        EthErc20 ethErc20Address
    )
        public
        virtual
        initializer
    {
        TokenManager.initializeTokenManager(
            newChainName,
            newMessageProxy,
            newIMALinker,
            newCommunityLocker,
            newDepositBox
        );
        ethErc20 = ethErc20Address;
    }

    // private

    function _exit(
        bytes32 chainHash,
        address messageReceiver,
        address to,
        uint256 amount
    )
        private
    {
        require(to != address(0), "Incorrect receiver address");

        if (amount > 0) {
            ethErc20.forceBurn(msg.sender, amount);
        }
        bytes memory data = Messages.encodeTransferEthMessage(to, amount);
        messageProxy.postOutgoingMessage(
            chainHash,
            messageReceiver,
            data
        );
    }
}
