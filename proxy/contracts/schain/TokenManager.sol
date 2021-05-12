// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaiev
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

import "./MessageProxyForSchain.sol";
import "./SkaleFeaturesClient.sol";
import "./TokenManagerLinker.sol";


/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
abstract contract TokenManager is SkaleFeaturesClient {

    MessageProxyForSchain public messageProxy;
    TokenManagerLinker public tokenManagerLinker;
    bytes32 public schainId;
    address public depositBox;
    bool public automaticDeploy;

    modifier onlySchainOwner() {
        require(_isSchainOwner(msg.sender), "Sender is not an Schain owner");
        _;
    }

    constructor(
        string memory newSchainName,
        MessageProxyForSchain newMessageProxyAddress,
        TokenManagerLinker newIMALinker,
        address newDepositBox
    )
        public
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        schainId = keccak256(abi.encodePacked(newSchainName));
        messageProxy = newMessageProxyAddress;
        tokenManagerLinker = newIMALinker;
        depositBox = newDepositBox;
    }

    function postMessage(
        string calldata fromSchainID,
        address sender,
        bytes calldata data
    )
        external
        virtual
        returns (bool);

    /**
     * @dev Allows Schain owner turn on automatic deploy on schain.
     */
    function enableAutomaticDeploy() external onlySchainOwner {
        automaticDeploy = true;
    }

    /**
     * @dev Allows Schain owner turn off automatic deploy on schain.
     */
    function disableAutomaticDeploy() external onlySchainOwner {
        automaticDeploy = false;
    }

    function addTokenManager(string calldata schainID, address newTokenManagerAddress) external virtual;

    function removeTokenManager(string calldata schainID) external virtual;

    function addDepositBox(address newDepositBoxAddress) external virtual;

    function removeDepositBox() external virtual;

    function hasTokenManager(string calldata schainID) external view virtual returns (bool);

    function hasDepositBox() external view virtual returns (bool);

    // private

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function _isSchainOwner(address sender) internal view returns (bool) {
        return sender == getSkaleFeatures().getConfigVariableAddress(
            "skaleConfig.contractSettings.IMA.ownerAddress"
        );
    }
}