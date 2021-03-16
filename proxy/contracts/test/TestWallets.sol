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

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./TestSchainsInternal.sol";


contract Wallets {
    using SafeMath for uint;

    ContractManager public contractManager;

    mapping (bytes32 => uint) private _schainWallets;

    event SchainWalletRecharged(address sponsor, uint amount, bytes32 schainId);

    event NodeRefundedBySchain(address node, bytes32 schainId, uint amount);

    function addContractManager(address newContractManager) external {
        contractManager = ContractManager(newContractManager);
    }

    function refundGasBySchain(
        bytes32 schainId,
        address payable spender,
        uint spentGas,
        bool
    )
        external
    {
        uint amount = tx.gasprice * spentGas;
        require(schainId != bytes32(0), "SchainId cannot be null");
        require(amount <= _schainWallets[schainId], "Schain wallet has not enough funds");
        _schainWallets[schainId] = _schainWallets[schainId].sub(amount);
        emit NodeRefundedBySchain(spender, schainId, amount);
        spender.transfer(amount);
    }

    function rechargeSchainWallet(bytes32 schainId) external payable {
        SchainsInternal schainsInternal = SchainsInternal(contractManager.getContract("SchainsInternal"));
        require(schainsInternal.isSchainActive(schainId), "Schain should be active for recharging");
        _schainWallets[schainId] = _schainWallets[schainId].add(msg.value);
        emit SchainWalletRecharged(msg.sender, msg.value, schainId);
    }
}
