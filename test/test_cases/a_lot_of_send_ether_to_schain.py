from tools.test_case import TestCase
from tools.test_pool import test_pool
import time


class ALotOfTransactionsSendEtherToSchain(TestCase):
    def __init__(self, config):
        super().__init__('Send ether a lot of times to schain', config)

    def _execute(self):
        address = self.blockchain.key_to_address(self.config.schain_key)
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        # 2 finney (2 000 000 000 000 000 wei)
        amount = 2 * 10 ** 15
        #
        for x in range(100):
            self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           amount,
                                                           self.timeout)
        #
        balance = self.blockchain.get_balance_on_schain(address)
        if balance == initial_balance + 100 * amount:
            self._mark_passed()

test_pool.register_test(ALotOfTransactionsSendEtherToSchain)
