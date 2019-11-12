from logging import debug

from tools.test_case import TestCase
from tools.test_pool import test_pool
import time


class SendEtherFromSchainToMainnetAndBack(TestCase):

    def __init__(self, config):
        super().__init__('load_send_ether_from_mainnet_to_schain_and_back', config)

    def _execute(self):
        #
        range_int = 5
        # ETH
        eth_amount = 5 * 10 ** 18
        #
        address = self.blockchain.key_to_address(self.config.schain_key)
        #  transfer to schain
        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       eth_amount,
                                                       self.timeout)
        #
        balance = self.blockchain.get_balance_on_schain(address)
        initial_balance = balance
        # 2 finney (2 000 000 000 000 000 wei)
        amount = 2 * 10 ** 15
        # 4 finney back because when we send on mainnet we should pay 2 finney for each transaction to validator
        amount_from_schain = 4 * 10 ** 15
        #
        for x in range(range_int):
            #  transfer to schain
            self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                           self.config.schain_key,
                                                           amount,
                                                           self.timeout)
            time.sleep(2)
            # back to mainnet
            self.agent.transfer_eth_from_schain_to_mainnet(self.config.schain_key,
                                                           self.config.mainnet_key,
                                                           amount_from_schain,
                                                           self.timeout)
            self.blockchain.get_balance_on_schain(address)
            a = 0
        #
        balance = self.blockchain.get_balance_on_schain(address)
        res = initial_balance - range_int * amount
        if balance == initial_balance - range_int * amount:
            self._mark_passed()


test_pool.register_test(SendEtherFromSchainToMainnetAndBack)
