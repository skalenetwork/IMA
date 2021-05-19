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

    constructor(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        address newDepositBox,
        EthErc20 _ethErc20
    )
        public
        TokenManager(newChainName, newMessageProxy, newIMALinker, newDepositBox)
    {
        ethErc20 = _ethErc20;
    }

    function setEthErc20Address(EthErc20 newEthErc20Address) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        require(ethErc20 != newEthErc20Address, "The same address");
        ethErc20 = newEthErc20Address;
    }

    /**
     * @dev Performs an exit (post outgoing message) to Mainnet.
     */
    function exitToMain(address to, uint256 amount) external {
        require(to != address(0), "Incorrect receiver address");

        _burnEthErc20(msg.sender, amount);
        messageProxy.postOutgoingMessage(
            "Mainnet",
            depositBox,
            Messages.encodeTransferEthMessage(to, amount)
        );
    }

    function transferToSchain(
        string memory targetSchainName,
        address to,
        uint256 amount
    )
        external
    {
        bytes32 targetSchainId = keccak256(abi.encodePacked(targetSchainName));
        require(
            targetSchainId != MAINNET_ID,
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagers[targetSchainId] != address(0), "Incorrect Token Manager address");
        require(to != address(0), "Incorrect receiver address");

        _burnEthErc20(msg.sender, amount);
        messageProxy.postOutgoingMessage(
            targetSchainName,
            tokenManagers[targetSchainId],
            Messages.encodeTransferEthMessage(to, amount)
        );
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
        string calldata fromSchainName,
        address sender,
        bytes calldata data
    )
        external
        override
        returns (bool)
    {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        bytes32 fromSchainId = keccak256(abi.encodePacked(fromSchainName));
        require(
            fromSchainId != schainId && 
                (
                    fromSchainId == MAINNET_ID ?
                    sender == depositBox :
                    sender == tokenManagers[fromSchainId]
                ),
            "Receiver chain is incorrect"
        );
        Messages.TransferEthMessage memory decodedMessage = Messages.decodeTransferEthMessage(data);
        address receiver = decodedMessage.receiver;
        require(receiver != address(0), "Incorrect receiver");
        ethErc20.mint(receiver, decodedMessage.amount);
        return true;
    }

    // private

    function _burnEthErc20(address account, uint amount) private {
        if (amount > 0) {
            ethErc20.forceBurn(account, amount);
        }
    }
}