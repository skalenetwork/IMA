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