// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   FallbackEthTester.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2022-Present SKALE Labs
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


pragma solidity 0.8.6;

import "@skalenetwork/ima-interfaces/mainnet/DepositBoxes/IDepositBoxEth.sol";
import "@skalenetwork/ima-interfaces/mainnet/ICommunityPool.sol";

interface IFallbackEthTester {
    receive() external payable;
    function deposit() external payable;
    function rechargeUserWallet() external payable;
    function getMyEth() external;
}


contract FallbackEthTester is IFallbackEthTester {
    IDepositBoxEth public depositBoxEth;
    ICommunityPool public communityPool;

    string public schainName;

    bool private _receiveInProgress;
    bool private _getMyEthInProgress;

    constructor(
        IDepositBoxEth newDepositBoxEth,
        ICommunityPool newCommunityPool,
        string memory newSchainName
    ) {
        depositBoxEth = newDepositBoxEth;
        communityPool = newCommunityPool;
        schainName = newSchainName;
    }

    receive() external payable override {
        if (!_receiveInProgress && !_getMyEthInProgress) {
            _receiveInProgress = true;
            uint256 balance = communityPool.getBalance(address(this), schainName);
            communityPool.withdrawFunds(schainName, balance);
            _receiveInProgress = false;
        }
    }

    function deposit() external payable override {
        depositBoxEth.deposit{value: msg.value}(schainName);
    }

    function rechargeUserWallet() external payable override {
        communityPool.rechargeUserWallet{value: msg.value}(schainName, address(this));
    }

    function getMyEth() external override {
        _getMyEthInProgress = true;
        depositBoxEth.getMyEth();
        _getMyEthInProgress = false;
    }
}