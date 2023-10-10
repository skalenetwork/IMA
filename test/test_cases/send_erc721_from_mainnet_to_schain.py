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
from logging import debug

from tools.test_case import TestCase
from tools.test_pool import test_pool


class SendERC721ToSchain(TestCase):
    erc721 = None
    tokenId = 1

    def __init__(self, config):
        super().__init__('Send ERC721 to schain', config)

    def _prepare(self):
        sleep( 5 )
        self.erc721 = self.blockchain.deploy_erc721_on_mainnet(self.config.mainnet_key, 'elv721', 'ELV')

        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc721.functions.mint(address, self.tokenId)\
            .buildTransaction({
                'gas': 8000000,
                'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})

        signed_txn = self.blockchain.web3_mainnet.eth.account.signTransaction(mint_txn,
                                                                              private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)
        self.blockchain.disableWhitelistERC721(self.config.mainnet_key, self.config.schain_name)
        self.blockchain.enableAutomaticDeployERC721(self.config.schain_key, "Mainnet")

    def _execute(self):

        self.agent.transfer_erc721_from_mainnet_to_schain(
            self.erc721,
            self.config.mainnet_key,
            self.config.schain_key,
            self.tokenId,
            0,
            self.timeout
        )

        erc721 = self.blockchain.get_erc721_on_schain("Mainnet", self.erc721.address)
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)
        new_owner_address = erc721.functions.ownerOf(self.tokenId).call()
        if destination_address == new_owner_address:
            self._mark_passed()

test_pool.register_test(SendERC721ToSchain)
