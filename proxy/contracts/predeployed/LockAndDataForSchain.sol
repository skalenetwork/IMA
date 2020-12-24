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

import "./EthERC20.sol";
import "./OwnableForSchain.sol";


/**
 * @title Lock and Data For SKALE chain
 * @dev Runs on SKALE chains, holds deposited ETH, and contains mappings and
 * balances of ETH tokens received through DepositBox.
 */
contract LockAndDataForSchain is OwnableForSchain {
    using SafeMath for uint256;

    address private _ethErc20Address;

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

    bool private _isCustomDeploymentMode = false;

    modifier allow(string memory contractName) {
        require(
            _checkPermitted(contractName,msg.sender) ||
            getSchainOwner() == msg.sender, "Not allowed LockAndDataForSchain");
        _;
    }

    constructor() public {
        _isCustomDeploymentMode = true;
        authorizedCaller[msg.sender] = true;
    }

    /**
     * @dev Allows Owner to set a EthERC20 contract address.
     */
    function setEthErc20Address(address newEthErc20Address) external onlySchainOwner {
        _ethErc20Address = newEthErc20Address;
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
    function setContract(string calldata contractName, address newContract) external virtual onlySchainOwner {
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
    function addSchain(string calldata schainID, address tokenManagerAddress) external {
        require(isAuthorizedCaller(msg.sender) || getSchainOwner() == msg.sender, "Not authorized caller");
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0), "SKALE chain is already set");
        require(tokenManagerAddress != address(0), "Incorrect Token Manager address");
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
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
        require(isAuthorizedCaller(msg.sender) || getSchainOwner() == msg.sender, "Not authorized caller");
        require(depositBoxAddress != address(0), "Incorrect Deposit Box address");
        require(
            tokenManagerAddresses[
                keccak256(abi.encodePacked("Mainnet"))
            ] != depositBoxAddress,
            "Deposit Box is already set"
        );
        tokenManagerAddresses[
            keccak256(abi.encodePacked("Mainnet"))
        ] = depositBoxAddress;
    }

    /**
     * @dev Allows Owner to remove a DepositBox from LockAndDataForSchain.
     *
     * Requirements:
     *
     * - DepositBox must already be set.
     */
    function removeDepositBox() external onlySchainOwner {
        require(
            tokenManagerAddresses[
                keccak256(abi.encodePacked("Mainnet"))
            ] != address(0),
            "Deposit Box is not set"
        );
        delete tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))];
    }

    /**
     * @dev Allows Owner to add an authorized caller.
     */
    function addAuthorizedCaller(address caller) external onlySchainOwner {
        authorizedCaller[caller] = true;
    }

    /**
     * @dev Allows Owner to remove an authorized caller.
     */
    function removeAuthorizedCaller(address caller) external onlySchainOwner {
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
        require(EthERC20(getEthErc20Address()).mint(to, amount), "Mint error");
        return true;
    }

    /**
     * @dev Allows TokenManager to receive (burn) ETH to LockAndDataForSchain.
     */
    function receiveEth(address sender, uint256 amount) external allow("TokenManager") returns (bool) {
        EthERC20(getEthErc20Address()).burnFrom(sender, amount);
        return true;
    }

    function isAuthorizedCaller(address a) public view returns (bool rv) { // l_sergiy: added
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
        if (_ethErc20Address == address(0) && (!_isCustomDeploymentMode)) {
            return SkaleFeatures(
                    getSkaleFeaturesAddress()
                ).getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.EthERC20"
            );
        }
        addressOfEthErc20 = _ethErc20Address;
    }

    function getContract(string memory contractName) public view returns (address) {
        bytes32 contractId = keccak256(abi.encodePacked(contractName));

        if (permitted[contractId] == address(0) && (!_isCustomDeploymentMode)) {
            string memory fullContractPath = string(abi.encodePacked(
                "skaleConfig.contractSettings.IMA.",
                contractName
            ));

            address contractAddressInStorage = SkaleFeatures(
                getSkaleFeaturesAddress()
            ).getConfigVariableAddress(fullContractPath);

            return contractAddressInStorage;
        }
        return permitted[contractId];
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

    function getMessageProxy() external view returns (address) {
        return getContract(MESSAGE_PROXY);
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



