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
import "../tokens/EthERC20.sol";
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

    EthERC20 private _ethErc20;

    /**
     * TX_FEE - equals "Eth exit" operation gas consumption (300 000 gas) multiplied by
     * max gas price of "Eth exit" (200 Gwei) = 60 000 000 Gwei = 0.06 Eth
     *
     * !!! IMPORTANT !!!
     * It is a max estimation, of "Eth exit" operation.
     * If it would take less eth - it would be returned to the mainnet DepositBox.
     * And you could take it back or send back to SKALE-chain.
     * !!! IMPORTANT !!!
     */
    uint256 public constant TX_FEE = 60000000000000000;

    modifier rightTransaction(string memory schainID) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")),
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagers[schainHash] != address(0), "Incorrect Token Manager address");
        _;
    }

    modifier receivedEth(uint256 amount) {
        if (amount > 0) {
            EthERC20(getEthErc20Address()).burnFrom(msg.sender, amount);
        }
        _;
    }

    /// Create a new token manager

    constructor(
        string memory newChainID,
        MessageProxyForSchain newMessageProxyAddress,
        TokenManagerLinker newIMALinker,
        address newDepositBox
    )
        public
        TokenManager(newChainID, newMessageProxyAddress, newIMALinker, depositBox)
        // solhint-disable-next-line no-empty-blocks
    { }

    function setEthErc20Address(address newEthERC20Address) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        require(address(_ethErc20) != newEthERC20Address, "The same address");
        _ethErc20 = EthERC20(newEthERC20Address);
    }

    /**
     * @dev Performs an exit (post outgoing message) to Mainnet.
     */
    function exitToMain(address to, uint256 amount) external receivedEth(amount) {
        require(to != address(0), "Incorrect receiver address");
        require(amount >= TX_FEE, "Not enough funds to exit");
        messageProxy.postOutgoingMessage(
            "Mainnet",
            depositBox,
            Messages.encodeTransferEthMessage(to, amount)
        );
    }

    function transferToSchain(
        string memory schainID,
        address to,
        uint256 amount
    )
        external
        rightTransaction(schainID)
        receivedEth(amount)
    {
        require(to != address(0), "Incorrect receiver address");
        address tokenManagerAddress = tokenManagers[keccak256(abi.encodePacked(schainID))];
        require(tokenManagerAddress != address(0), "Unconnected chain");
        messageProxy.postOutgoingMessage(
            schainID,
            tokenManagerAddress,
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
        string calldata fromSchainID,
        address sender,
        bytes calldata data
    )
        external
        override
        returns (bool)
    {
        require(msg.sender == address(messageProxy), "Not a sender");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != schainId && 
            (
                schainHash == keccak256(abi.encodePacked("Mainnet")) ?
                sender == depositBox :
                sender == tokenManagers[schainHash]
            ),
            "Receiver chain is incorrect"
        );
        Messages.TransferEthMessage memory decodedMessage = Messages.decodeTransferEthMessage(data);
        address receiver = decodedMessage.receiver;
        require(receiver != address(0), "Incorrect receiver");
        require(EthERC20(getEthErc20Address()).mint(receiver, decodedMessage.amount), "Mint error");
        return true;
    }

    function getEthErc20Address() public view returns (EthERC20) {
        if (address(_ethErc20) == address(0)) {
            return EthERC20(
                getSkaleFeatures().getConfigVariableAddress(
                    "skaleConfig.contractSettings.IMA.EthERC20"
                )
            );
        }
        return _ethErc20;
    }
}