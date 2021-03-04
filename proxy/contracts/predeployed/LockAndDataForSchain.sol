// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   LockAndDataForSchain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IEthERC20.sol";
import "../interfaces/IMessageProxy.sol";
import "./SkaleFeatures.sol";


/**
 * @title Lock and Data For SKALE chain
 * @dev Runs on SKALE chains, holds deposited ETH, and contains mappings and
 * balances of ETH tokens received through DepositBox.
 */
contract LockAndDataForSchain is Ownable {
    using SafeMath for uint256;

    mapping(bytes32 => address) public permitted;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(address => uint256) public ethCosts;

    mapping(address => bool) public authorizedCaller;

    string public constant ERC20_MODULE = "ERC20Module";
    string public constant ERC721_MODULE = "ERC721Module";
    string public constant LOCK_AND_DATA_ERC20 = "LockAndDataERC20";
    string public constant LOCK_AND_DATA_ERC721 = "LockAndDataERC721";
    string public constant TOKEN_MANAGER = "TokenManager";
    string public constant TOKEN_FACTORY = "TokenFactory";
    string public constant MESSAGE_PROXY = "MessageProxy";
    string public constant ETH_ERC20 = "EthERC20";
    string public constant LOCK_AND_DATA = "LockAndData";

    bool private _isCustomDeploymentMode = false;

    address public schainOwner;

    modifier allow(string memory contractName) {
        require(
            _checkPermitted(contractName,msg.sender) ||
            getAdmin() == msg.sender, "Not allowed LockAndDataForSchain");
        _;
    }

    /**
     * @dev Throws if called by any account other than the schain owner.
     */
    modifier onlySchainOwner() {
        require(
            _msgSender() == getSchainOwner() || _msgSender() == getAdmin(),
            "Only schain owner can execute this method"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the admin.
     */
    modifier onlyAdmin() {
        require(_msgSender() == getAdmin(), "Only admin can execute this method");
        _;
    }

    constructor() public Ownable() {
        _isCustomDeploymentMode = true;
        authorizedCaller[msg.sender] = true;
        schainOwner = msg.sender;
    }

    /**
     * @dev Allows Owner to set a new contract address.
     *
     * Requirements:
     *
     * - New contract address must be non-zero.
     * - New contract address must not already be added.
     * - Contract must contain code.
     */
    function setContract(string calldata contractName, address newContract) external virtual onlyAdmin {
        require(newContract != address(0), "New address is equal zero");

        bytes32 contractId = keccak256(abi.encodePacked(contractName));
        require(!_checkPermitted(contractName, newContract), "Contract is already added");

        uint256 length;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            length := extcodesize(newContract)
        }
        require(length > 0, "Given contract address does not contain code");
        permitted[contractId] = newContract;
    }

    /**
     * @dev Checks whether LockAndDataForSchain is connected to a SKALE chain.
     */
    function hasSchain( string calldata schainID ) external view returns (bool) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        if ( tokenManagerAddresses[schainHash] == address(0) ) {
            return false;
        }
        return true;
    }

    /**
     * @dev Adds a SKALE chain and its TokenManager address to
     * LockAndDataForSchain.
     *
     * Requirements:
     *
     * - `msg.sender` must be authorized caller.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addSchain(string calldata schainID, address tokenManagerAddress) external onlySchainOwner {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0), "SKALE chain is already set");
        require(tokenManagerAddress != address(0), "Incorrect Token Manager address");
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
        IMessageProxy(getMessageProxy()).addConnectedChain(schainID);
    }

    /**
     * @dev Allows Owner to remove a SKALE chain from LockAndDataForSchain.
     *
     * Requirements:
     *
     * - SKALE chain must already be set.
     */
    function removeSchain(string calldata schainID) external onlySchainOwner {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerAddresses[schainHash];
        IMessageProxy(getMessageProxy()).removeConnectedChain(schainID);
    }

    /**
     * @dev Checks whether LockAndDataForSchain is connected to a DepositBox.
     */
    function hasDepositBox() external view returns(bool) {
        bytes32 depositBoxHash = keccak256(abi.encodePacked("Mainnet"));
        if ( tokenManagerAddresses[depositBoxHash] == address(0) ) {
            return false;
        }
        return true;
    }

    /**
     * @dev Adds a DepositBox address to LockAndDataForSchain.
     *
     * Requirements:
     *
     * - `msg.sender` must be authorized caller.
     * - DepositBox must not already be added.
     * - DepositBox address must be non-zero.
     */
    function addDepositBox(address depositBoxAddress) external {
        bytes32 mainnetHash = keccak256(abi.encodePacked("Mainnet"));
        require(isAuthorizedCaller(msg.sender) || getAdmin() == msg.sender, "Not authorized caller");
        require(tokenManagerAddresses[mainnetHash] == address(0), "Deposit Box is already set");
        require(depositBoxAddress != address(0), "Incorrect Deposit Box address");
        tokenManagerAddresses[mainnetHash] = depositBoxAddress;
        IMessageProxy(getMessageProxy()).addConnectedChain("Mainnet");
    }

    /**
     * @dev Allows Owner to remove a DepositBox from LockAndDataForSchain.
     *
     * Requirements:
     *
     * - DepositBox must already be set.
     */
    function removeDepositBox() external onlyAdmin {
        bytes32 mainnetHash = keccak256(abi.encodePacked("Mainnet"));
        require(tokenManagerAddresses[mainnetHash] != address(0), "Deposit Box is not set");
        delete tokenManagerAddresses[mainnetHash];
        IMessageProxy(getMessageProxy()).removeConnectedChain("Mainnet");
    }

    /**
     * @dev Allows Owner to add an authorized caller.
     */
    function addAuthorizedCaller(address caller) external onlyAdmin {
        authorizedCaller[caller] = true;
    }

    /**
     * @dev Allows Owner to remove an authorized caller.
     */
    function removeAuthorizedCaller(address caller) external onlyAdmin {
        authorizedCaller[caller] = false;
    }

    /**
     * @dev Allows TokenManager to add gas costs to LockAndDataForSchain.
     */
    function addGasCosts(address to, uint256 amount) external allow("TokenManager") {
        ethCosts[to] = ethCosts[to].add(amount);
    }

    /**
     * @dev Allows TokenManager to reduce gas costs from LockAndDataForSchain.
     */
    function reduceGasCosts(address to, uint256 amount) external allow("TokenManager") returns (bool) {
        if (ethCosts[to] >= amount) {
            ethCosts[to] -= amount;
            return true;
        } else if (ethCosts[address(0)] >= amount) {
            ethCosts[address(0)] -= amount;
            return true;
        }
        return false;
    }

    /**
     * @dev Allows TokenManager to remove gas costs from LockAndDataForSchain.
     */
    function removeGasCosts(address to) external allow("TokenManager") returns (uint256 balance) {
        balance = ethCosts[to];
        delete ethCosts[to];
    }

    /**
     * @dev Allows TokenManager to send (mint) ETH from LockAndDataForSchain.
     */
    function sendEth(address to, uint256 amount) external allow("TokenManager") returns (bool) {
        require(IEthERC20(getEthErc20Address()).mint(to, amount), "Mint error");
        return true;
    }

    /**
     * @dev Allows TokenManager to receive (burn) ETH to LockAndDataForSchain.
     */
    function receiveEth(address sender, uint256 amount) external allow("TokenManager") returns (bool) {
        IEthERC20(getEthErc20Address()).burnFrom(sender, amount);
        return true;
    }

    /**
     * @dev Returns admin address.
     */
    function getAdmin() public view returns (address) {
        if (owner() == address(0))
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.adminAddress"
            );
        return owner();
    }

    /**
     * @dev Returns schain owner address.
     */
    function getSchainOwner() public view returns (address) {
        if (schainOwner == address(0))
            return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.schainOwnerAddress"
            );
        return schainOwner;
    }

    function getSkaleFeaturesAddress() public view returns (address) {
        return 0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2;
    }

    function isAuthorizedCaller(address a) public view returns (bool rv) {
        if (authorizedCaller[a] )
            return true;
        if (_isCustomDeploymentMode)
            return false;
        uint256 u = SkaleFeatures(getSkaleFeaturesAddress()).getConfigPermissionFlag(
            a, "skaleConfig.contractSettings.IMA.variables.MessageProxy.mapAuthorizedCallers"
        );
        if ( u != 0 )
            return true;
        return false;
    }

    /**
     * @dev Returns EthERC20 contract address.
     */
    function getEthErc20Address() public view returns (address addressOfEthErc20) {
        return getContract(ETH_ERC20);
    }

    function getContract(string memory contractName) public view returns (address contractAddress) {
        contractAddress = permitted[keccak256(abi.encodePacked(contractName))];

        if (contractAddress == address(0) && (!_isCustomDeploymentMode)) {
            contractAddress = SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                string(abi.encodePacked("skaleConfig.contractSettings.IMA.", contractName))
            );
        }
        require(contractAddress != address(0), "Contract has not been found");
    }

    function getMessageProxy() public view returns (address) {
        return getContract(MESSAGE_PROXY);
    }

    function getErc20Module() external view returns (address) {
        return getContract(ERC20_MODULE);
    }

    function getErc721Module() external view returns (address) {
        return getContract(ERC721_MODULE);
    }

    function getLockAndDataErc20() external view returns (address) {
        return getContract(LOCK_AND_DATA_ERC20);
    }

    function getLockAndDataErc721() external view returns (address) {
        return getContract(LOCK_AND_DATA_ERC721);
    }

    function getTokenManager() external view returns (address) {
        return getContract(TOKEN_MANAGER);
    }

    function getTokenFactory() external view returns (address) {
        return getContract(TOKEN_FACTORY);
    }

    /**
     * @dev Checks whether contract name and address are permitted.
     */
    function _checkPermitted(string memory contractName, address contractAddress) 
        private
        view
        returns
        (bool permission)
    {
        require(contractAddress != address(0), "contract address required to check permitted status");
        bytes32 contractId = keccak256(abi.encodePacked(contractName));
        bool isPermitted = (permitted[contractId] == contractAddress) ? true : false;
        if ((isPermitted) ) {
            permission = true;
        } else {
            if (!_isCustomDeploymentMode) {
                string memory fullContractPath = string(abi.encodePacked(
                    "skaleConfig.contractSettings.IMA.variables.LockAndData.permitted.",
                    contractName
                ));
                address contractAddressInStorage = SkaleFeatures(
                    getSkaleFeaturesAddress()
                ).getConfigVariableAddress(fullContractPath);
                if (contractAddressInStorage == contractAddress) {
                    permission = true;
                } else {
                    permission = false;
                }
            } else {
                permission = false;
            }
        }
    }

}



