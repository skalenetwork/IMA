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

from time import sleep
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
        sleep( 5 )
        amountRecharge = 2 * 10 ** 18
        self.blockchain.recharge_user_wallet(self.config.mainnet_key, self.config.schain_name, amountRecharge)
        sleep( 5 )
        # deploy token
        self.erc721 = self.blockchain.deploy_erc721_on_mainnet(self.config.mainnet_key, 'elv721', 'ELV')
        # mint
        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc721.functions.mint(address, self.token_id)\
            .buildTransaction({
                'gas': 8000000,
                'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})
        signed_txn = self.blockchain.web3_mainnet.eth.account\
            .signTransaction(mint_txn, private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)
        self.blockchain.disableWhitelistERC721(self.config.mainnet_key, self.config.schain_name)
        self.blockchain.enableAutomaticDeployERC721(self.config.schain_key, "Mainnet")
        # send to schain
        self.agent.transfer_erc721_from_mainnet_to_schain(self.erc721,
                                                          self.config.mainnet_key,
                                                          self.config.schain_key,
                                                          self.token_id,
                                                          self.timeout)
        sleep( 5 )
        #
        amount_eth = 90 * 10 ** 15
        #
        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       amount_eth,
                                                       self.timeout)

        #
        sleep( 5 )
        self.erc721_clone = self.blockchain.get_erc721_on_schain("Mainnet", self.erc721.address)

    def _execute(self):
        source_address = self.blockchain.key_to_address(self.config.mainnet_key)
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)

        if self.erc721_clone.functions.ownerOf(self.token_id).call() != source_address:
            error("Token was not send")
            return
        #
        sleep( 5 )
        self.agent.transfer_erc721_from_schain_to_mainnet(
            self.erc721_clone,
            self.erc721,
            self.config.mainnet_key,
            self.config.schain_key,
            self.token_id,
            6 * 10 ** 16,
            self.timeout
        )
        #
        # erc721 = self.blockchain.get_erc721_on_mainnet(self.token_id)
        # new_owner_address = erc721.functions.ownerOf(self.token_id).call()
        new_owner_address = self.erc721.functions.ownerOf(self.token_id).call()
        if destination_address == new_owner_address:
            self._mark_passed()


test_pool.register_test(Senderc721ToMainnet)
