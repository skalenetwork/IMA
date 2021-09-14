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
import time


class ALotOfTransactionsSendEtherToSchain(TestCase):
    def __init__(self, config):
        super().__init__('Send ether a lot of times to schain', config)

    def _execute(self):
        #
        range_int = 5
        #
        address = self.blockchain.key_to_address(self.config.mainnet_key)
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        # 2 ether (2 000 000 000 000 000 000 wei)
        amount = 2 * 10 ** 18
        #
        for x in range(range_int):
            self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           amount,
                                                           self.timeout)
            a = 23
        #
        balance = self.blockchain.get_balance_on_schain(address)
        if balance == initial_balance + range_int * amount:
            self._mark_passed()

test_pool.register_test(ALotOfTransactionsSendEtherToSchain)

#  singe trans
#   Gas usage:

#  3 trans
#   Gas usage: 111058
#   Gas usage: 66122
#   Gas usage: 66122

#  7 trans
#   Gas usage: 111058
