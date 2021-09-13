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

from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendEtherToSchain(TestCase):
    def __init__(self, config):
        super().__init__('Send ether to schain', config)

    def _execute(self):
        address = self.blockchain.key_to_address(self.config.mainnet_key)
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        amount = 2 * 10 ** 15 # 2 finney

        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       amount,
                                                       self.timeout)

        balance = self.blockchain.get_balance_on_schain(address)
        if balance == initial_balance + amount:
            self._mark_passed()

test_pool.register_test(SendEtherToSchain)
