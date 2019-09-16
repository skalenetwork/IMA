from time import sleep, time
from logging import debug, error

from tools.test_case import TestCase
from tools.test_pool import test_pool


class Senderc721ToMainnet(TestCase):
    erc721 = None
    erc721_clone = None
    token_id = 1

    def __init__(self, config):
        super().__init__('Send ERC721 from schain to mainnet', config)

    def _prepare(self):
        # deploy token
        self.erc721 = self.blockchain.deploy_erc721_on_mainnet(self.config.mainnet_key, 'elv721', 'ELV')
        # mint
        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc721.functions.mint(address, self.token_id)\
            .buildTransaction({
                'gas': 8000000,
                'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})
        #
        sleep(5)

        signed_txn = self.blockchain.web3_mainnet.eth.account\
            .signTransaction(mint_txn, private_key=self.config.mainnet_key)
        #
        sleep(5)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)
        sleep(5)
        # send to schain
        self.agent.transfer_erc721_from_mainnet_to_schain(self.erc721,
                                                          self.config.mainnet_key,
                                                          self.config.schain_key,
                                                          self.token_id,
                                                          self.timeout)
        sleep(5)
        #
        amount_eth = 90 * 10 ** 15
        #
        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       amount_eth,
                                                       self.timeout)

        #
        sleep(5)
        self.blockchain.add_eth_cost(self.config.schain_key,
                                     amount_eth)
        #
        sleep(5)
        self.erc721_clone = self.blockchain.get_erc721_on_schain(self.token_id)

    def _execute(self):
        source_address = self.blockchain.key_to_address(self.config.schain_key)
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)

        if self.erc721_clone.functions.ownerOf(self.token_id).call() != source_address:
            error("Token was not send")
            return
        #
        sleep(5)
        self.agent.transfer_erc721_from_schain_to_mainnet(self.erc721_clone,
                                                          self.config.schain_key,
                                                          self.config.mainnet_key,
                                                          self.token_id,
                                                          self.timeout)
        #
        # erc721 = self.blockchain.get_erc721_on_mainnet(self.token_id)
        # new_owner_address = erc721.functions.ownerOf(self.token_id).call()
        new_owner_address = self.erc721.functions.ownerOf(self.token_id).call()
        if destination_address == new_owner_address:
            self._mark_passed()


test_pool.register_test(Senderc721ToMainnet)
