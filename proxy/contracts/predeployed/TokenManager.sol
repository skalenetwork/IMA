/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE-IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE-IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE-IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity ^0.5.3;

import "./PermissionsForSchain.sol";
import "./../interfaces/IMessageProxy.sol";
import "./../interfaces/IERC20Module.sol";
import "./../interfaces/IERC721Module.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721Full.sol";

interface ILockAndDataTM {
    function setContract(string calldata contractName, address newContract) external;
    function tokenManagerAddresses(bytes32 schainHash) external returns (address);
    function sendEth(address to, uint256 amount) external returns (bool);
    function receiveEth(address sender, uint256 amount) external returns (bool);
    function approveTransfer(address to, uint256 amount) external;
    function ethCosts(address to) external returns (uint256);
    function addGasCosts(address to, uint256 amount) external;
    function reduceGasCosts(address to, uint256 amount) external returns (bool);
    function removeGasCosts(address to) external returns (uint256);
}

// This contract runs on schains and accepts messages from main net creates ETH clones.
// When the user exits, it burns them


contract TokenManager is PermissionsForSchain {


    enum TransactionOperation {
        transferETH,
        transferERC20,
        transferERC721,
        rawTransferERC20,
        rawTransferERC721
    }

    // ID of this schain,
    string private chainID_; // l_sergiy: changed name _ and made private
    address private proxyForSchainAddress_; // l_sergiy: changed name _ made private

    // The maximum amount of ETH clones this contract can create
    // It is 102000000 which is the current total ETH supply

    // TODO: TOKEN_RESERVE = 102000000 * (10 ** 18);

    //uint256 public TOKEN_RESERVE = 102000000 * (10 ** 18); //ether
    //uint256 public TOKEN_RESERVE = 10 * (10 ** 18); //ether

    uint256 public constant GAS_AMOUNT_POST_MESSAGE = 200000;
    uint256 public constant AVERAGE_TX_PRICE = 10000000000;

    // Owner of this schain. For mainnet
    //address public owner;

    event Error(
        address sender,
        string fromSchainID,
        address to,
        uint256 amount,
        bytes data,
        string message
    );

    modifier rightTransaction(string memory schainID) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address schainTokenManagerAddress = ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(schainHash);
        require(schainHash != keccak256(abi.encodePacked("Mainnet")), "This function is not for transfering to Mainnet");
        require(schainTokenManagerAddress != address(0), "Incorrect Token Manager address");
        _;
    }

    modifier receivedEth(uint256 amount) {
        require(amount >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE, "Null Amount");
        require(ILockAndDataTM(getLockAndDataAddress()).receiveEth(msg.sender, amount), "Could not receive ETH Clone");
        _;
    }


    /// Create a new token manager

    constructor(
        string memory newChainID,
        address newProxyAddress,
        address newLockAndDataAddress
    )
        PermissionsForSchain(newLockAndDataAddress)
        public
    {
        chainID_ = newChainID;
        proxyForSchainAddress_ = newProxyAddress;
    }

    function() external payable {
        revert("Not allowed. in TokenManager");
    }

    // function withdraw() external {
    //     if (msg.sender == owner) {
    //         owner.transfer(address(this).balance);
    //     }
    // }

    function exitToMainWithoutData(address to, uint256 amount) external {
        exitToMain(to, amount);
    }

    function transferToSchainWithoutData(string calldata schainID, address to, uint256 amount) external {
        transferToSchain(schainID, to, amount);
    }

    function addEthCostWithoutAddress(uint256 amount) external {
        addEthCost(amount);
    }

    function removeEthCost() external {
        uint256 returnBalance = ILockAndDataTM(getLockAndDataAddress()).removeGasCosts(msg.sender);
        require(ILockAndDataTM(getLockAndDataAddress()).sendEth(msg.sender, returnBalance), "Not sent");
    }

    function exitToMainERC20(address contractHere, address to, uint256 amount) external {
        address lockAndDataERC20 = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        address erc20Module = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("ERC20Module")));
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        require(
            ILockAndDataTM(getLockAndDataAddress()).reduceGasCosts(
                msg.sender,
                GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE),
            "Not enough gas sent");
        bytes memory data = IERC20Module(erc20Module).receiveERC20(
            contractHere,
            to,
            amount,
            false);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE,
            address(0),
            data
        );
    }

    function rawExitToMainERC20(
        address contractHere,
        address contractThere,
        address to,
        uint256 amount) external
        {
        address lockAndDataERC20 = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        address erc20Module = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("ERC20Module")));
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        require(
            ILockAndDataTM(getLockAndDataAddress()).reduceGasCosts(
                msg.sender,
                GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE),
            "Not enough gas sent");
        bytes memory data = IERC20Module(erc20Module).receiveERC20(
            contractHere,
            to,
            amount,
            true);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE,
            contractThere,
            data
        );
    }

    function transferToSchainERC20(
        string calldata schainID,
        address contractHere,
        address to,
        uint256 amount) external
        {
        address lockAndDataERC20 = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        address erc20Module = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("ERC20Module")));
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        bytes memory data = IERC20Module(erc20Module).receiveERC20(
            contractHere,
            to,
            amount,
            false);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            0,
            address(0),
            data
        );
    }

    function rawTransferToSchainERC20(
        string calldata schainID,
        address contractHere,
        address contractThere,
        address to,
        uint256 amount) external
        {
        address lockAndDataERC20 = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("LockAndDataERC20")));
        address erc20Module = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("ERC20Module")));
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Not allowed ERC20 Token"
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender,
                lockAndDataERC20,
                amount
            ),
            "Could not transfer ERC20 Token"
        );
        bytes memory data = IERC20Module(erc20Module).receiveERC20(
            contractHere,
            to,
            amount,
            true);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            0,
            contractThere,
            data
        );
    }

    function exitToMainERC721(address contractHere, address to, uint256 tokenId) external {
        address lockAndDataERC721 = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        address erc721Module = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("ERC721Module")));
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721Full(contractHere).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721Full(contractHere).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        require(
            ILockAndDataTM(getLockAndDataAddress()).reduceGasCosts(
                msg.sender,
                GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE),
            "Not enough gas sent");
        bytes memory data = IERC721Module(erc721Module).receiveERC721(
            contractHere,
            to,
            tokenId,
            false);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE,
            address(0),
            data
        );
    }

    function rawExitToMainERC721(
        address contractHere,
        address contractThere,
        address to,
        uint256 tokenId) external
        {
        address lockAndDataERC721 = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        address erc721Module = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("ERC721Module")));
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721Full(contractHere).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721Full(contractHere).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        require(
            ILockAndDataTM(getLockAndDataAddress()).reduceGasCosts(
                msg.sender,
                GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE),
            "Not enough gas sent");
        bytes memory data = IERC721Module(erc721Module).receiveERC721(
            contractHere,
            to,
            tokenId,
            true);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE,
            contractThere,
            data
        );
    }

    function transferToSchainERC721(
        string calldata schainID,
        address contractHere,
        address to,
        uint256 tokenId) external
        {
        address lockAndDataERC721 = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        address erc721Module = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("ERC721Module")));
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721Full(contractHere).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721Full(contractHere).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        bytes memory data = IERC721Module(erc721Module).receiveERC721(
            contractHere,
            to,
            tokenId,
            false);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            0,
            address(0),
            data
        );
    }

    function rawTransferToSchainERC721(
        string calldata schainID,
        address contractHere,
        address contractThere,
        address to,
        uint256 tokenId) external
        {
        address lockAndDataERC721 = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("LockAndDataERC721")));
        address erc721Module = IContractManagerForSchain(getLockAndDataAddress()).
            permitted(keccak256(abi.encodePacked("ERC721Module")));
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this), "Not allowed ERC721 Token");
        IERC721Full(contractHere).transferFrom(address(this), lockAndDataERC721, tokenId);
        require(IERC721Full(contractHere).ownerOf(tokenId) == lockAndDataERC721, "Did not transfer ERC721 token");
        bytes memory data = IERC721Module(erc721Module).receiveERC721(
            contractHere,
            to,
            tokenId,
            true);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            0,
            contractThere,
            data
        );
    }

    // Receive money from main net and Schain

    function postMessage(
        address sender,
        string calldata fromSchainID,
        address to,
        uint256 amount,
        bytes calldata data
    )
        external
    {
        require(msg.sender == getProxyForSchainAddress(), "Not a sender");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        if (schainHash == keccak256(abi.encodePacked(getChainID())) || sender != ILockAndDataTM(
            getLockAndDataAddress()).tokenManagerAddresses(schainHash)) {
            emit Error(
                sender,
                fromSchainID,
                to,
                amount,
                data,
                "Receiver chain is incorrect"
            );
            return;
        }

        if (data.length == 0) {
            emit Error(
                sender,
                fromSchainID,
                to,
                amount,
                data,
                "Invalid data");
            return;
        }

        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(to != address(0), "Incorrect receiver");
            require(ILockAndDataTM(getLockAndDataAddress()).sendEth(to, amount), "Not Sent");
            return;
        } else if ((operation == TransactionOperation.transferERC20 && to==address(0)) ||
                  (operation == TransactionOperation.rawTransferERC20 && to!=address(0))) {
            address erc20Module = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("ERC20Module")));
            require(IERC20Module(erc20Module).sendERC20(to, data), "Failed to send ERC20");
            address receiver = IERC20Module(erc20Module).getReceiver(to, data);
            require(ILockAndDataTM(getLockAndDataAddress()).sendEth(receiver, amount), "Not Sent");
        } else if ((operation == TransactionOperation.transferERC721 && to==address(0)) ||
                  (operation == TransactionOperation.rawTransferERC721 && to!=address(0))) {
            address erc721Module = IContractManagerForSchain(getLockAndDataAddress()).permitted(keccak256(abi.encodePacked("ERC721Module")));
            require(IERC721Module(erc721Module).sendERC721(to, data), "Failed to send ERC721");
            address receiver = IERC721Module(erc721Module).getReceiver(to, data);
            require(ILockAndDataTM(getLockAndDataAddress()).sendEth(receiver, amount), "Not Sent");
        }
    }

    // This is called by schain owner.
    // Exit to main net
    function exitToMain(address to, uint256 amount) public {
        bytes memory empty = "";
        exitToMain(to, amount, empty);
    }

    function exitToMain(address to, uint256 amount, bytes memory data) public receivedEth(amount) {
        bytes memory newData;
        newData = abi.encodePacked(bytes1(uint8(1)), data);
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            "Mainnet",
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked("Mainnet"))),
            amount,
            to,
            newData
        );
    }

    function transferToSchain(string memory schainID, address to, uint256 amount) public {
        bytes memory data = "";
        transferToSchain(
            schainID,
            to,
            amount,
            data);
    }

    function transferToSchain(
        string memory schainID,
        address to,
        uint256 amount,
        bytes memory data
    )
        public
        rightTransaction(schainID)
        receivedEth(amount)
    {
        IMessageProxy(getProxyForSchainAddress()).postOutgoingMessage(
            schainID,
            ILockAndDataTM(getLockAndDataAddress()).tokenManagerAddresses(keccak256(abi.encodePacked(schainID))),
            amount,
            to,
            data
        );
    }

    function addEthCost(uint256 amount) public {
        addEthCost(msg.sender, amount);
    }

    function addEthCost(address sender, uint256 amount) public receivedEth(amount) {
        ILockAndDataTM(getLockAndDataAddress()).addGasCosts(sender, amount);
    }

    function getChainID() public view returns ( string memory cID ) { // l_sergiy: added
        if ((keccak256(abi.encodePacked(chainID_))) == (keccak256(abi.encodePacked(""))) ) {
            return SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).getConfigVariableString("skaleConfig.sChain.schainID");
        }
        return chainID_;
    }

    function getProxyForSchainAddress() public view returns ( address ow ) { // l_sergiy: added
        if (proxyForSchainAddress_ == address(0) ) {
            return SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).getConfigVariableAddress("skaleConfig.contractSettings.IMA.messageProxyAddress");
        }
        return proxyForSchainAddress_;
    }

    /**
     * @dev Convert first byte of data to Operation
     * 0x01 - transfer eth
     * 0x03 - transfer ERC20 token
     * 0x05 - transfer ERC721 token
     * 0x13 - transfer ERC20 token - raw mode
     * 0x15 - transfer ERC721 token - raw mode
     * @param data - received data
     * @return operation
     */
    function fallbackOperationTypeConvert(bytes memory data)
        internal
        pure
        returns (TransactionOperation)
    {
        bytes1 operationType;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            operationType := mload(add(data, 0x20))
        }
        require(
            operationType == 0x01 ||
            operationType == 0x03 ||
            operationType == 0x05 ||
            operationType == 0x13 ||
            operationType == 0x15,
            "Operation type is not identified"
        );
        if (operationType == 0x01) {
            return TransactionOperation.transferETH;
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        } else if (operationType == 0x13) {
            return TransactionOperation.rawTransferERC20;
        } else if (operationType == 0x15) {
            return TransactionOperation.rawTransferERC721;
        }
    }

}
