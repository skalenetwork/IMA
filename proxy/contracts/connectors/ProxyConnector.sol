// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ProxyConnector.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
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

import "./BasicConnector.sol";
import "../interfaces/ISchainsInternal.sol";
import "../interfaces/IWallets.sol";
import "../interfaces/ISchains.sol";
import "../MessageProxyForMainnet.sol";


/**
 * @title ProxyConnector - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract ProxyConnector is BasicConnector {

    /**
     * @dev initialize - sets current address of ContractManager of SkaleManager
     * @param newContractManagerOfSkaleManager - current address of ContractManager of SkaleManager
     */
    function initialize(
        address newContractManagerOfSkaleManager
    )
        public
        virtual
        override
        initializer
    {
        BasicConnector.initialize(newContractManagerOfSkaleManager);
    }

    /**
     * @dev Checks whether sender is node address from the SKALE chain
     */
    function isAuthorizedCaller(bytes32 chainId, address sender) public view returns (bool) {
        address skaleSchainsInternal = IContractManager(contractManagerOfSkaleManager).getContract("SchainsInternal");
        return ISchainsInternal(skaleSchainsInternal).isNodeAddressesInGroup(
            chainId,
            sender
        );
    }

    function _refundGasBySchain(bytes32 schainId, uint gasTotal) internal {
        address walletsAddress = IContractManager(contractManagerOfSkaleManager).getContract("Wallets");
        IWallets(payable(walletsAddress)).refundGasBySchain(schainId, msg.sender, gasTotal.sub(gasleft()), false);
    }

    /**
     * @dev Converts calldata structure to memory structure and checks
     * whether message BLS signature is valid.
     */
    function _verifyMessages(
        string calldata srcChainID,
        bytes32 hashedMessages,
        MessageProxyForMainnet.Signature calldata sign
    )
        internal
        view
        returns (bool)
    {
        return ISchains(
            IContractManager(
                contractManagerOfSkaleManager
            ).getContract(
                "Schains"
            )
        ).verifySchainSignature(
            sign.blsSignature[0],
            sign.blsSignature[1],
            hashedMessages,
            sign.counter,
            sign.hashA,
            sign.hashB,
            srcChainID
        );
    }
}
