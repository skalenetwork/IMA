from tools.test_case import TestCase
from time import sleep
from tools.test_pool import test_pool


class SendEtherToSchain(TestCase):
    def __init__(self, config):
        super().__init__('Send ether to schain', config)

    def _execute(self):
        address = self.blockchain.key_to_address(self.config.schain_key)
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        amount = 2 # finney

        self.agent._execute_command('m2s-payment', {'finney': amount})

        while not balance == initial_balance + amount * 10 ** 15:
            balance = self.blockchain.get_balance_on_schain(self.blockchain.key_to_address(self.config.schain_key))

            if self._timeout():
                return
            else:
                sleep(1)

        self._mark_passed()

test_pool.register_test(SendEtherToSchain)