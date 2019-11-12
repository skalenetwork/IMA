from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendEtherToSchain(TestCase):
    def __init__(self, config):
        super().__init__('Send ether to schain', config)

    def _execute(self):
        address = self.blockchain.key_to_address(self.config.schain_key)
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
