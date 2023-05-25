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
from logging import error

from tools.test_case import TestCase
from tools.test_pool import test_pool


class Senderc1155ToMainnet(TestCase):
    erc1155 = None
    erc1155_clone = None
    token_id = 1
    token_amount = 4

    def __init__(self, config):
        super().__init__('Send ERC1155 from schain to mainnet', config)

    def _prepare(self):
        sleep( 5 )
        amountRecharge = 2 * 10 ** 18
        self.blockchain.recharge_user_wallet(self.config.mainnet_key, self.config.schain_name, amountRecharge)
        sleep( 5 )
        # deploy token
        self.erc1155 = self.blockchain.deploy_erc1155_on_mainnet(self.config.mainnet_key, 'elv1155')
        # mint
        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc1155.functions.mint(address, self.token_id, self.token_amount, "0x")\
            .buildTransaction({
                'gas': 8000000,
                'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})
        signed_txn = self.blockchain.web3_mainnet.eth.account\
            .signTransaction(mint_txn, private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)
        self.blockchain.disableWhitelistERC1155(self.config.mainnet_key, self.config.schain_name)
        self.blockchain.enableAutomaticDeployERC1155(self.config.schain_key, "Mainnet")
        # send to schain
        self.agent.transfer_erc1155_from_mainnet_to_schain(self.erc1155,
                                                          self.config.mainnet_key,
                                                          self.config.schain_key,
                                                          self.token_id,
                                                          self.token_amount,
                                                          self.timeout)
        sleep( 5 )
        amount_eth = 90 * 10 ** 15
        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       amount_eth,
                                                       self.timeout)
        sleep( 5 )
        self.erc1155_clone = self.blockchain.get_erc1155_on_schain("Mainnet", self.erc1155.address)

    def _execute(self):
        source_address = self.blockchain.key_to_address(self.config.mainnet_key)
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)

        if self.erc1155_clone.functions.balanceOf(source_address, self.token_id).call() != self.token_amount:
            error("Token was not send")
            return
        sleep( 5 )
        self.agent.transfer_erc1155_from_schain_to_mainnet(
            self.erc1155_clone,
            self.erc1155,
            self.config.mainnet_key,
            self.config.schain_key,
            self.token_id,
            self.token_amount,
            6 * 10 ** 16,
            self.timeout
        )
        #
        # erc1155 = self.blockchain.get_erc1155_on_mainnet(self.token_id)
        # new_owner_address = erc1155.functions.ownerOf(self.token_id).call()
        new_amount = self.erc1155.functions.balanceOf(destination_address, self.token_id).call()
        if self.token_amount == new_amount:
            self._mark_passed()


test_pool.register_test(Senderc1155ToMainnet)
