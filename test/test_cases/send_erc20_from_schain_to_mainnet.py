from time import sleep, time
from logging import debug, error

from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendERC20ToMainnet(TestCase):
    erc20 = None
    erc20_clone = None
    amount = 1

    def __init__(self, config):
        super().__init__('Send ERC20 to schain', config)

    def _prepare(self):

        # deploy token

        self.erc20 = self.blockchain.deploy_erc20_on_mainnet(self.config.mainnet_key, 'D2-Token', 'D2', 2)

        # mint

        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc20.functions.mint(address, 1).buildTransaction({
            'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})

        signed_txn = self.blockchain.web3_mainnet.eth.account.signTransaction(mint_txn,
                                                                              private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

        # send to schain

        self.agent.transfer_erc20_from_mainnet_to_schain(self.erc20,
                                                         self.config.mainnet_key,
                                                         self.config.schain_key,
                                                         self.amount,
                                                         self.timeout)

        self.erc20_clone = self.blockchain.get_erc20_on_schain(1)

    def _execute(self):
        destination_address = self.blockchain.key_to_address(self.config.schain_key)
        balance = self.erc20.functions.balanceOf(destination_address).call()

        print('Send from schain to mainnet')

        self.agent.transfer_erc20_from_schain_to_mainnet(self.erc20_clone,
                                                         self.config.mainnet_key,
                                                         self.config.schain_key,
                                                         self.amount,
                                                         self.timeout)

        if self.erc20.functions.balanceOf(destination_address).call() == balance + self.amount:
            self._mark_passed()


test_pool.register_test(SendERC20ToMainnet)
