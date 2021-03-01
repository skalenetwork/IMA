// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForSchainWorkaround.sol - SKALE Interchain Messaging Agent
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

import "../predeployed/MessageProxyForSchain.sol";


contract MessageProxyForSchainWorkaround is MessageProxyForSchain {

    constructor(string memory newChainID, address lockAndDataAddress)
        public
        MessageProxyForSchain(newChainID, lockAndDataAddress)
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    function registerExtraContract(string calldata schainName, address contractOnSchain) external override {
        bytes32 schainNameHash = keccak256(abi.encodePacked(schainName));
        // will not check is contractOnSchain is a Contract
        // require(contractOnSchain.isContract(), "Given address is not a contract");
        require(!registryContracts[schainNameHash][contractOnSchain], "Extra contract is already registered");
        registryContracts[schainNameHash][contractOnSchain] = true;
    }

}
