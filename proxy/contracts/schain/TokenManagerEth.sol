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

import "../interfaces/ITokenManager.sol";
import "./connectors/LinkerConnectorSchain.sol";

import "./EthERC20.sol";
import "../Messages.sol";


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
contract TokenManagerEth is LinkerConnectorSchain, ITokenManager {

    address public depositBoxEth;

    address private _ethErc20Address;

    mapping(bytes32 => address) public tokenManagerEthAddresses;

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
        require(tokenManagerEthAddresses[schainHash] != address(0), "Incorrect Token Manager address");
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
        address newMessageProxyAddress,
        address newIMALinker
    )
        public
        LinkerConnectorSchain(newChainID, newMessageProxyAddress, newIMALinker)
    {
        
    }

    /**
     * @dev Adds a DepositBoxEth address to
     * TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - DepositBoxEth must not already be added.
     * - DepositBoxEth address must be non-zero.
     */
    function addDepositBox(address newDepositBoxEthAddress) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        require(depositBoxEth == address(0), "DepositBoxEth is already set");
        require(newDepositBoxEthAddress != address(0), "Incorrect DepoositBoxEth address");
        depositBoxEth = newDepositBoxEthAddress;
    }

    /**
     * @dev Allows Owner to remove a DepositBoxEth on SKALE chain
     * from TokenManagerEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - DepositBoxEth must already be set.
     */
    function removeDepositBox() external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        require(depositBoxEth != address(0), "DepositBoxEth is not set");
        delete depositBoxEth;
    }

    /**
     * @dev Adds a TokenManagerEth address to
     * DepositBoxEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * = or imaLinker contract.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addTokenManager(string calldata schainID, address newTokenManagerEthAddress) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerEthAddresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerEthAddress != address(0), "Incorrect Token Manager address");
        tokenManagerEthAddresses[schainHash] = newTokenManagerEthAddress;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerEth on SKALE chain
     * from DepositBoxEth.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeTokenManager(string calldata schainID) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerEthAddresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerEthAddresses[schainHash];
    }

    /**
     * @dev Performs an exit (post outgoing message) to Mainnet.
     */
    function exitToMain(address to, uint256 amount) external receivedEth(amount) {
        require(to != address(0), "Incorrect receiver address");
        require(amount >= TX_FEE, "Not enough funds to exit");
        // uint amountOfEthToSend = amount >= TX_FEE ?
        //     amount :
        //     ILockAndDataTM(getLockAndDataAddress()).reduceCommunityPool(TX_FEE) ? TX_FEE : 0;
        // require(amountOfEthToSend != 0, "Community pool is empty");
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            depositBoxEth,
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
        address tokenManagerAddress = tokenManagerEthAddresses[keccak256(abi.encodePacked(schainID))];
        require(tokenManagerAddress != address(0), "Unconnected chain");
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
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
        require(msg.sender == getProxyForSchainAddress(), "Not a sender");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != keccak256(abi.encodePacked(getChainID())) && 
            (
                schainHash == keccak256(abi.encodePacked("Mainnet")) ?
                sender == depositBoxEth :
                sender == tokenManagerEthAddresses[schainHash]
            ),
            "Receiver chain is incorrect"
        );
        Messages.TransferEthMessage memory decodedMessage = Messages.decodeTransferEthMessage(data);
        require(
            decodedMessage.amount <= address(this).balance,
            "Not enough money to finish this transaction"
        );
        address receiver = decodedMessage.receiver;
        require(receiver != address(0), "Incorrect receiver");
        require(EthERC20(getEthErc20Address()).mint(receiver, decodedMessage.amount), "Mint error");
        return true;
    }

    /**
     * @dev Checks whether TokenManagerEth is connected to a {schainID} SKALE chain TokenManagerEth.
     */
    function hasTokenManager(string calldata schainID) external view override returns (bool) {
        return tokenManagerEthAddresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /**
     * @dev Checks whether TokenManagerEth is connected to a mainnet DepositBoxEth.
     */
    function hasDepositBox() external view override returns (bool) {
        return depositBoxEth != address(0);
    }

    function getEthErc20Address() public view returns (address) {
        if (_ethErc20Address == address(0)) {
            return SkaleFeatures(
                    getSkaleFeaturesAddress()
                ).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.EthERC20"
            );
        }
        return _ethErc20Address;
    }
}