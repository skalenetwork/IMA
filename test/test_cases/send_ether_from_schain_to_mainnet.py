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

from time import sleep

class SendEtherToMainnet(TestCase):
    amount = 7 * 10 ** 16  # 60 finney
    from_key = None
    to_key = None

    def __init__(self, config):
        super().__init__('Send ether from schain to mainnet', config)

    def _prepare(self):
        sleep( 5 )
        amountRecharge = 2 * 10 ** 18
        self.blockchain.recharge_user_wallet(self.config.mainnet_key, self.config.schain_name, amountRecharge)
        sleep( 5 )

        source_address = self.blockchain.key_to_address(self.config.schain_key)
        if self.blockchain.get_balance_on_schain(source_address) < self.amount:
            self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           self.amount,
                                                           timeout=self.timeout)
        min_transaction_fee = 21 * 10 ** 15
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)
        if self.blockchain.get_balance_on_mainnet(destination_address) < min_transaction_fee:
            self.blockchain.send_ether_on_mainnet(self.config.mainnet_key, self.config.mainnet_key, min_transaction_fee)
            sleep( 5 )

    def _execute(self):
        source_address = self.blockchain.key_to_address(self.config.mainnet_key)
        if self.blockchain.get_balance_on_schain(source_address) < self.amount:
            return

        debug('Balance on schain:', self.blockchain.get_balance_on_schain(source_address))


        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)
        balance = self.blockchain.get_balance_on_mainnet(destination_address)
        
        debug('Destination balance:', balance)

        self.agent.transfer_eth_from_schain_to_mainnet(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       self.amount,
                                                       self.timeout)
        sleep( 5 )

        transaction_fee = 6 * 10 ** 16
        approximate_gas_spends = 3 * 10 ** 15
        extra_subtract_value = 1 * 10 ** 17

        real_balance = self.blockchain.get_balance_on_mainnet(destination_address)
        print( 'Real balance.......', real_balance )
        expected_balance = balance + self.amount - transaction_fee - approximate_gas_spends - extra_subtract_value
        print( 'Expected balance...', expected_balance )

        if real_balance > expected_balance:
            print( 'Passed.............', 'YES!' )
            self._mark_passed()
        else:
            print( 'Passed.............', 'NO(' )


test_pool.register_test(SendEtherToMainnet)
