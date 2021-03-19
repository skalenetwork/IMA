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

import "./PermissionsForSchain.sol";
import "./../interfaces/IMessageProxy.sol";
import "./../interfaces/IERC20ModuleForSchain.sol";
import "./../interfaces/IERC721ModuleForSchain.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";

interface ILockAndDataTM {
    function setContract(string calldata contractName, address newContract) external;
    function tokenManagerAddresses(bytes32 schainHash) external returns (address);
    function sendEth(address to, uint256 amount) external returns (bool);
    function receiveEth(address sender, uint256 amount) external returns (bool);
    function reduceCommunityPool(uint256 amountOfEth) external returns (bool);
}

interface ILockAndDataERCOnSchain {
    function getERC20OnSchain(string calldata schainID, address contractOnMainnet) external view returns (address);
    function getERC721OnSchain(string calldata schainID, address contractOnMainnet) external view returns (address);
}

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
contract TokenManager is PermissionsForSchain {


    enum TransactionOperation {
        transferETH,
        transferERC20,
        transferERC721
    }

    // ID of this schain,
    string private _chainID;

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
        address schainTokenManagerAddress = ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(schainHash);
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")),
            "This function is not for transferring to Mainnet"
        );
        require(schainTokenManagerAddress != address(0), "Incorrect Token Manager address");
        _;
    }

    modifier receivedEth(uint256 amount) {
        if (amount > 0)
            require(
                ILockAndDataTM(getLockAndDataAddress()).receiveEth(msg.sender, amount),
                "Could not receive ETH Clone"
            );
        _;
    }

    /// Create a new token manager

    constructor(
        string memory newChainID,
        address newLockAndDataAddress
    )
        public
        PermissionsForSchain(newLockAndDataAddress)
    {
        _chainID = newChainID;
    }

    fallback() external payable {
        revert("Not allowed. in TokenManager");
    }

    function exitToMainERC20(
        address contractOnMainnet,
        address to,
        uint256 amount,
        uint256 amountOfEth
    )
        external
        receivedEth(amountOfEth)
    {
        address lockAndDataERC20 = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getLockAndDataErc20();
        address erc20Module = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getErc20Module();
        address contractOnSchain = ILockAndDataERCOnSchain(lockAndDataERC20)
            .getERC20OnSchain("Mainnet", contractOnMainnet);
        require(
            IERC20(contractOnSchain).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            IERC20(contractOnSchain).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        require(amountOfEth >= TX_FEE, "Not enough funds to exit");
        // uint amountOfEthToSend = amountOfEth >= TX_FEE ?
        //     amountOfEth :
        //     ILockAndDataTM(getLockAndDataAddress()).reduceCommunityPool(TX_FEE) ? TX_FEE : 0;
        // require(amountOfEthToSend != 0, "Community pool is empty");
        bytes memory data = IERC20ModuleForSchain(erc20Module).receiveERC20(
            "Mainnet",
            contractOnMainnet,
            to,
            amount);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amountOfEth,
            address(0),
            data
        );
    }

    function transferToSchainERC20(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 amount,
        uint256 amountOfEth
    )
        external
        receivedEth(amountOfEth)
    {
        address lockAndDataERC20 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc20();
        address erc20Module = LockAndDataForSchain(getLockAndDataAddress()).getErc20Module();
        address contractOnSchain = ILockAndDataERCOnSchain(lockAndDataERC20)
            .getERC20OnSchain(schainID, contractOnMainnet);
        require(
            IERC20(contractOnSchain).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            IERC20(contractOnSchain).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        bytes memory data = IERC20ModuleForSchain(erc20Module).receiveERC20(
            schainID,
            contractOnMainnet,
            to,
            amount);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amountOfEth,
            address(0),
            data
        );
    }

    function exitToMainERC721(
        address contractOnMainnet,
        address to,
        uint256 tokenId,
        uint256 amountOfEth
    )
        external
        receivedEth(amountOfEth)
    {
        address lockAndDataERC721 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc721();
        address erc721Module = LockAndDataForSchain(getLockAndDataAddress()).getErc721Module();
        address contractOnSchain = ILockAndDataERCOnSchain(lockAndDataERC721)
            .getERC721OnSchain("Mainnet", contractOnMainnet);
        require(IERC721(contractOnSchain).ownerOf(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721(contractOnSchain).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721(contractOnSchain).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        require(amountOfEth >= TX_FEE, "Not enough funds to exit");
        // uint amountOfEthToSend = amountOfEth >= TX_FEE ?
        //     amountOfEth :
        //     ILockAndDataTM(getLockAndDataAddress()).reduceCommunityPool(TX_FEE) ? TX_FEE : 0;
        // require(amountOfEthToSend != 0, "Community pool is empty");
        bytes memory data = IERC721ModuleForSchain(erc721Module).receiveERC721(
            "Mainnet",
            contractOnMainnet,
            to,
            tokenId);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amountOfEth,
            address(0),
            data
        );
    }

    function transferToSchainERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId,
        uint256 amountOfEth
    ) 
        external
        receivedEth(amountOfEth)
    {
        address lockAndDataERC721 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc721();
        address erc721Module = LockAndDataForSchain(getLockAndDataAddress()).getErc721Module();
        address contractOnSchain = ILockAndDataERCOnSchain(lockAndDataERC721)
            .getERC721OnSchain(schainID, contractOnMainnet);
        require(IERC721(contractOnSchain).ownerOf(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721(contractOnSchain).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721(contractOnSchain).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        bytes memory data = IERC721ModuleForSchain(erc721Module).receiveERC721(
            schainID,
            contractOnMainnet,
            to,
            tokenId);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amountOfEth,
            address(0),
            data
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
        address sender,
        string calldata fromSchainID,
        address to,
        uint256 amount,
        bytes calldata data
    )
        external
        returns (bool)
    {
        require(data.length != 0, "Invalid data");
        require(msg.sender == getProxyForSchainAddress(), "Not a sender");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != keccak256(abi.encodePacked(getChainID())) && 
            sender == ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(schainHash),
            "Receiver chain is incorrect"
        );
        TransactionOperation operation = _fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(ILockAndDataTM(getLockAndDataAddress()).sendEth(to, amount), "Not Sent");
        } else if (operation == TransactionOperation.transferERC20) {
            address erc20Module = LockAndDataForSchain(
                getLockAndDataAddress()
            ).getErc20Module();
            require(IERC20ModuleForSchain(erc20Module).sendERC20(fromSchainID, data), "Failed to send ERC20");
            address receiver = IERC20ModuleForSchain(erc20Module).getReceiver(data);
            require(ILockAndDataTM(getLockAndDataAddress()).sendEth(receiver, amount), "Not Sent");
        } else if (operation == TransactionOperation.transferERC721) {
            address erc721Module = LockAndDataForSchain(
                getLockAndDataAddress()
            ).getErc721Module();
            require(IERC721ModuleForSchain(erc721Module).sendERC721(fromSchainID, data), "Failed to send ERC721");
            address receiver = IERC721ModuleForSchain(erc721Module).getReceiver(data);
            require(ILockAndDataTM(getLockAndDataAddress()).sendEth(receiver, amount), "Not Sent");
        }
        return true;
    }

    /**
     * @dev Performs an exit (post outgoing message) to Mainnet.
     */
    function exitToMain(address to, uint256 amountOfEth) public receivedEth(amountOfEth) {
        require(to != address(0), "Incorrect contractThere address");
        require(amountOfEth >= TX_FEE, "Not enough funds to exit");
        // uint amountOfEthToSend = amountOfEth >= TX_FEE ?
        //     amountOfEth :
        //     ILockAndDataTM(getLockAndDataAddress()).reduceCommunityPool(TX_FEE) ? TX_FEE : 0;
        // require(amountOfEthToSend != 0, "Community pool is empty");
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amountOfEth,
            to,
            abi.encodePacked(bytes1(uint8(1)))
        );
    }

    function transferToSchain(
        string memory schainID,
        address to,
        uint256 amount
    )
        public
        rightTransaction(schainID)
        receivedEth(amount)
    {
        require(to != address(0), "Incorrect contractThere address");
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked(schainID))),
            amount,
            to,
            ""
        );
    }

    /**
     * @dev Returns chain ID.
     */
    function getChainID() public view returns ( string memory cID ) {
        if ((keccak256(abi.encodePacked(_chainID))) == (keccak256(abi.encodePacked(""))) ) {
            return SkaleFeatures(getSkaleFeaturesAddress())
                .getConfigVariableString("skaleConfig.sChain.schainName");
        }
        return _chainID;
    }

    /**
     * @dev Returns MessageProxy address.
     */
    function getProxyForSchainAddress() public view returns ( address ow ) {
        address proxyForSchainAddress = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getMessageProxy();
        if (proxyForSchainAddress != address(0) )
            return proxyForSchainAddress;
        return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
            "skaleConfig.contractSettings.IMA.MessageProxy"
        );
    }

    /**
     * @dev Converts the first byte of data to an operation.
     * 
     * 0x01 - transfer ETH
     * 0x03 - transfer ERC20 token
     * 0x05 - transfer ERC721 token
     * 
     * Requirements:
     * 
     * - Operation must be one of the possible types.
     */
    function _fallbackOperationTypeConvert(bytes memory data)
        private
        pure
        returns (TransactionOperation)
    {
        bytes1 operationType;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            operationType := mload(add(data, 0x20))
        }
        require(
            operationType == 0x01 ||
            operationType == 0x03 ||
            operationType == 0x05,
            "Operation type is not identified"
        );
        if (operationType == 0x01) {
            return TransactionOperation.transferETH;
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        }
    }

}
