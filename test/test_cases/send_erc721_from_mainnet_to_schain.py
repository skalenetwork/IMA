from time import sleep, time
from logging import debug

from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendERC721ToSchain(TestCase):
    erc721 = None
    tokenId = 13

    def __init__(self, config):
        super().__init__('Send ERC721 to schain', config)

    def _prepare(self):
        self.erc721 = self.blockchain.deploy_erc721_on_mainnet(self.config.mainnet_key, 'elv721', 'ELV')

        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc721.functions.mint(address, self.tokenId).buildTransaction({
            'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})

        signed_txn = self.blockchain.web3_mainnet.eth.account.signTransaction(mint_txn,
                                                                              private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def _execute(self):
        self.agent.transfer_erc721_from_mainnet_to_schain(self.erc721,
                                                         self.config.mainnet_key,
                                                         self.config.schain_key,
                                                         self.tokenId,
                                                         self.timeout)

        # erc20 = self.blockchain.get_erc20_on_schain(1)
        destination_address = self.blockchain.key_to_address(self.config.schain_key)
        new_owner_address = self.erc721.functions.ownerOf(self.tokenId).call()
        if destination_address == new_owner_address:
            self._mark_passed()

test_pool.register_test(SendERC721ToSchain)
