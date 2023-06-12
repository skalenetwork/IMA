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


class SendEtherFromSchainToMainnetAndBack(TestCase):

    def __init__(self, config):
        super().__init__('load_send_ether_from_mainnet_to_schain_and_back', config)

    def _execute(self):
        amountRecharge = 2 * 10 ** 18
        self.blockchain.recharge_user_wallet(self.config.mainnet_key, self.config.schain_name, amountRecharge)
        sleep( 5 )
        range_int = 5
        # ETH
        eth_amount = 12 * 10 ** 18
        address = self.blockchain.key_to_address(self.config.mainnet_key)
        #  transfer to schain
        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       eth_amount,
                                                       self.timeout)
        sleep( 5 )
        #
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        # 2 ether (2 000 000 000 000 000 000 wei)
        amount = 2 * 10 ** 18
        # 60 finney back because when we send on mainnet we should be able to cover gas fee on gasPrice 200 Gwei
        amount_from_schain = 7 * 10 ** 16
        #
        self.blockchain.set_time_limit_per_message(self.config.schain_key, 0)
        for x in range(range_int):
            #  transfer to schain
            self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           amount,
                                                           self.timeout)
            sleep( 5 )
            # back to mainnet
            self.agent.transfer_eth_from_schain_to_mainnet(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           amount_from_schain,
                                                           self.timeout)
            sleep( 5 )
            self.blockchain.get_balance_on_schain(address)
            a = 0
        #
        balance = self.blockchain.get_balance_on_schain(address)
        print( 'Real balance.......', balance )
        needed_balance = initial_balance + range_int * amount - range_int * amount_from_schain
        print( 'Needed balance.....', needed_balance )

        res = initial_balance - range_int * amount
        if balance == needed_balance:
            print( 'Passed.............', 'YES!' )
            self._mark_passed()
        else:
            print( 'Passed.............', 'NO(' )


test_pool.register_test(SendEtherFromSchainToMainnetAndBack)
