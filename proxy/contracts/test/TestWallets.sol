// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TestWallets.sol - SKALE Interchain Messaging Agent
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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@skalenetwork/skale-manager-interfaces/IWallets.sol";

import "./TestSchainsInternal.sol";


contract Wallets is IWallets {
    using SafeMathUpgradeable for uint;

    ContractManager public contractManager;

    mapping (bytes32 => uint) private _schainWallets;

    event SchainWalletRecharged(address sponsor, uint amount, bytes32 schainHash);

    event NodeRefundedBySchain(address node, bytes32 schainHash, uint amount);

    function addContractManager(address newContractManager) external {
        contractManager = ContractManager(newContractManager);
    }

    function refundGasBySchain(
        bytes32 schainHash,
        address payable spender,
        uint spentGas,
        bool
    )
        external
        override
    {
        uint amount = tx.gasprice * spentGas;
        require(schainHash != bytes32(0), "SchainHash cannot be null");
        require(amount <= _schainWallets[schainHash], "Schain wallet has not enough funds");
        _schainWallets[schainHash] = _schainWallets[schainHash].sub(amount);
        emit NodeRefundedBySchain(spender, schainHash, amount);
        spender.transfer(amount);
    }

    function rechargeSchainWallet(bytes32 schainHash) external payable override {
        SchainsInternal schainsInternal = SchainsInternal(contractManager.getContract("SchainsInternal"));
        require(schainsInternal.isSchainActive(schainHash), "Schain should be active for recharging");
        _schainWallets[schainHash] = _schainWallets[schainHash].add(msg.value);
        emit SchainWalletRecharged(msg.sender, msg.value, schainHash);
    }
}
