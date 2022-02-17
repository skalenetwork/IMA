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

pragma solidity 0.8.6;

import "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerEth.sol";

import "../../Messages.sol";
import "../TokenManager.sol";


/**
 * @title TokenManagerEth
 * @dev Runs on SKALE Chains and
 * accepts messages from mainnet.
 * TokenManagerEth mints EthErc20 tokens. When a user exits a SKALE chain, it burns them.
 */
contract TokenManagerEth is TokenManager, ITokenManagerEth {

    IEthErc20 public ethErc20;

    /// Create a new token manager    

    /**
     * @dev Register EthErc20 token.
     */
    function setEthErc20Address(IEthErc20 newEthErc20Address) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        require(ethErc20 != newEthErc20Address, "Must be new address");
        ethErc20 = newEthErc20Address;
    }

    /**
     * @dev Move ETH from schain to mainnet.
     * 
     * EthErc20 tokens are burned on schain and ETH are unlocked on mainnet for {to} address.
     */
    function exitToMain(uint256 amount) external override {
        communityLocker.checkAllowedToSendMessage(msg.sender);
        _exit(MAINNET_HASH, depositBox, msg.sender, amount);
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     *
     * Requirements:
     * 
     * - MessageProxy must be the sender.
     * - `fromChainHash` must exist in TokenManager addresses.
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

    /**
     * @dev Is called once during contract deployment.
     */
    function initialize(
        string memory newChainName,
        IMessageProxyForSchain newMessageProxy,
        ITokenManagerLinker newIMALinker,
        ICommunityLocker newCommunityLocker,
        address newDepositBox,
        IEthErc20 ethErc20Address
    )
        external
        override
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

    /**
     * @dev Checks whether sender contract is DepositBox.
     */
    function _checkSender(bytes32 fromChainHash, address sender) internal view override returns (bool) {
        return fromChainHash == MAINNET_HASH && sender == depositBox;
    }

    /**
     * @dev Burn EthErc20 tokens on schain and send message to unlock ETH on target chain.
     */
    function _exit(
        bytes32 chainHash,
        address messageReceiver,
        address to,
        uint256 amount
    )
        private
    {
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
