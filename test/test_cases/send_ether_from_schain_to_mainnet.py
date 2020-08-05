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

from logging import debug

from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendEtherToMainnet(TestCase):
    amount = 3 * 10 ** 15  # 3 finney
    from_key = None
    to_key = None

    def __init__(self, config):
        super().__init__('Send ether from schain to mainnet', config)

    def _prepare(self):
        source_address = self.blockchain.key_to_address(self.config.schain_key)
        if self.blockchain.get_balance_on_schain(source_address) < self.amount:
            self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           self.amount,
                                                           timeout=self.timeout)
        min_transaction_fee = 21 * 10 ** 15
        destination_address = self.blockchain.key_to_address(self.config.user_key)
        if self.blockchain.get_balance_on_mainnet(destination_address) < min_transaction_fee:
            self.blockchain.send_ether_on_mainnet(self.config.mainnet_key, self.config.user_key, min_transaction_fee)

    def _execute(self):
        source_address = self.blockchain.key_to_address(self.config.schain_key)
        if self.blockchain.get_balance_on_schain(source_address) < self.amount:
            return

        debug('Balance on schain:', self.blockchain.get_balance_on_schain(source_address))


        destination_address = self.blockchain.key_to_address(self.config.user_key)
        balance = self.blockchain.get_balance_on_mainnet(destination_address)
        
        debug('Destination balance:', balance)

        self.agent.transfer_eth_from_schain_to_mainnet(self.config.schain_key,
                                                       self.config.user_key,
                                                       self.amount,
                                                       self.timeout)

        transaction_fee = 2 * 10 ** 15
        approximate_gas_spends = 21 * 10 ** 13
        if self.blockchain.get_balance_on_mainnet(destination_address) > (
                balance + self.amount - transaction_fee - approximate_gas_spends):
            self._mark_passed()


test_pool.register_test(SendEtherToMainnet)