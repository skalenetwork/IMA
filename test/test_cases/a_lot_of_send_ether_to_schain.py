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
        address = self.blockchain.key_to_address(self.config.schain_key)
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        # 2 finney (2 000 000 000 000 000 wei)
        amount = 2 * 10 ** 15
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
