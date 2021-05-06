// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   VerifierConnectorSchain.sol - SKALE Interchain Messaging Agent
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

// import "../bls/SkaleVerifier.sol";

import "../MessageProxyForSchain.sol";

import "./AuthorizedConnectorSchain.sol";


/**
 * @title VerifierConnectorSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract VerifierConnectorSchain is AuthorizedConnectorSchain {

    /**
     * @dev constructtor - sets chainID
     */
    constructor(string memory chainID) public AuthorizedConnectorSchain(chainID) {

    }

    /**
     * @dev Converts calldata structure to memory structure and checks
     * whether message BLS signature is valid.
     * Returns true if signature is valid
     */
    function _verifyMessages(
        bytes32 hashedMessages,
        MessageProxyForSchain.Signature calldata signature
    )
        internal
        view
        virtual
        returns (bool)
    {
        // return SkaleVerifier.verify(
        //     Fp2Operations.Fp2Point({
        //         a: signature.blsSignature[0],
        //         b: signature.blsSignature[1]
        //     }),
        //     hashedMessages,
        //     signature.counter,
        //     signature.hashA,
        //     signature.hashB,
        //     _getBlsCommonPublicKey()
        // );
    }

    // function _getBlsCommonPublicKey() private view returns (G2Operations.G2Point memory) {
    //     SkaleFeatures skaleFeature = SkaleFeatures(getSkaleFeaturesAddress());
    //     return G2Operations.G2Point({
    //         x: Fp2Operations.Fp2Point({
    //             a: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey0"),
    //             b: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey1")
    //         }),
    //         y: Fp2Operations.Fp2Point({
    //             a: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey2"),
    //             b: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey3")
    //         })
    //     });
    // }
}
