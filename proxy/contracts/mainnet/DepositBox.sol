// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBox.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Artem Payvin
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

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../interfaces/IMainnetContract.sol";
import "./MessageProxyForMainnet.sol";
import "./Linker.sol";


/**
 * @title IMAConnected - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
abstract contract DepositBox is SkaleManagerClient, AccessControlUpgradeable, IMainnetContract {

    bytes32 public constant DEPOSIT_BOX_MANAGER_ROLE = keccak256("DEPOSIT_BOX_MANAGER_ROLE");

    MessageProxyForMainnet public messageProxy;

    modifier onlyMessageProxy() {
        require(msg.sender == address(messageProxy), "Sender is not a MessageProxy");
        _;
    }
    
    function initialize(
        IContractManager contractManagerOfSkaleManager,
        Linker linkerAddress,
        MessageProxyForMainnet messageProxyAddress
    )
        public
        virtual
        initializer
    {
        SkaleManagerClient.initialize(contractManagerOfSkaleManager);
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(DEPOSIT_BOX_MANAGER_ROLE, address(linkerAddress));
        messageProxy = messageProxyAddress;
    }
}
