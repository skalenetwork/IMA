// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TestSchains.sol - SKALE Interchain Messaging Agent
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


pragma solidity 0.8.27;

import "./TestContractManager.sol";
import "./KeyStorageMock.sol";
import "./SkaleVerifierMock.sol";


interface ISchainsTester {
    function addContractManager(address newContractManager) external;
        function verifySchainSignature(
        uint signatureA,
        uint signatureB,
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB,
        string calldata schainName
    )
        external
        view
        returns (bool);
}


contract Schains is ISchainsTester {

    ContractManager public contractManager;

    function addContractManager(address newContractManager) external override {
        contractManager = ContractManager(newContractManager);
    }

    function verifySchainSignature(
        uint signatureA,
        uint signatureB,
        bytes32 hash,
        uint counter,
        uint hashA,
        uint hashB,
        string calldata schainName
    )
        external
        view
        override
        returns (bool)
    {
        SkaleVerifierMock skaleVerifier = SkaleVerifierMock(contractManager.getContract("SkaleVerifier"));
        IFieldOperations.G2Point memory publicKey = KeyStorageMock(
            contractManager.getContract("KeyStorage")
        ).getBlsCommonPublicKeyForSchain(
            keccak256(abi.encodePacked(schainName))
        );
        return skaleVerifier.verify(
            IFieldOperations.Fp2Point({
                a: signatureA,
                b: signatureB
            }),
            hash, counter,
            hashA, hashB,
            publicKey
        );
    }
}
