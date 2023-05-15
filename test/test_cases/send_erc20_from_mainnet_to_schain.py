#   SPDX-License-Identifier: AGPL-3.0-only
#   -*- coding: utf-8 -*-
#
#   This file is part of SKALE IMA.
#
#   Copyright (C) 2019-Present SKALE Labs
#
#   SKALE IMA is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   SKALE IMA is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.

from time import sleep

from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendERC20ToSchain(TestCase):
    erc20 = None

    def __init__(self, config):
        super().__init__('Send ERC20 to schain', config)

    def _prepare(self):
        sleep( 5 )
        self.erc20 = self.blockchain.deploy_erc20_on_mainnet(self.config.mainnet_key, 'D2-Token', 'D2', 100)

        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc20.functions.mint(address, 1)\
            .buildTransaction({
                'gas': 8000000,
                'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})

        signed_txn = self.blockchain.web3_mainnet.eth.account.signTransaction(mint_txn,
                                                                              private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)
        self.blockchain.disableWhitelistERC20(self.config.mainnet_key, self.config.schain_name)
        self.blockchain.enableAutomaticDeployERC20(self.config.schain_key, "Mainnet")

    def _execute(self):
        amount = 1
        self.agent.transfer_erc20_from_mainnet_to_schain(
            self.erc20,
            self.config.mainnet_key,
            self.config.schain_key,
            amount,
            0,
            self.timeout
        )

        erc20 = self.blockchain.get_erc20_on_schain("Mainnet", self.erc20.address)
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)
        balance = erc20.functions.balanceOf(destination_address).call()
        if balance == amount:
            self._mark_passed()

test_pool.register_test(SendERC20ToSchain)
