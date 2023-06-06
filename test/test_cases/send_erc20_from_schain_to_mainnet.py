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


class SendERC20ToMainnet(TestCase):
    erc20 = None
    erc20_clone = None
    amount = 4
    # index of token in token_manager_erc20.sol
    index = 1

    def __init__(self, config):
        super().__init__('Send ERC20 from schain to mainnet', config)

    def _prepare(self):
        sleep( 5 )
        amountRecharge = 2 * 10 ** 18
        self.blockchain.recharge_user_wallet(self.config.mainnet_key, self.config.schain_name, amountRecharge)
        sleep( 5 )

        # deploy token

        self.erc20 = self.blockchain.deploy_erc20_on_mainnet(self.config.mainnet_key, 'D2-Token', 'D2', 100)

        # mint

        address = self.blockchain.key_to_address(self.config.mainnet_key)
        mint_txn = self.erc20.functions.mint(address, self.amount)\
            .buildTransaction({
                'gas': 8000000,
                'nonce': self.blockchain.get_transactions_count_on_mainnet(address)})

        signed_txn = self.blockchain.web3_mainnet.eth.account.signTransaction(mint_txn,
                                                                              private_key=self.config.mainnet_key)
        self.blockchain.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)
        self.blockchain.disableWhitelistERC20(self.config.mainnet_key, self.config.schain_name)
        self.blockchain.enableAutomaticDeployERC20(self.config.schain_key, "Mainnet")

        # send to schain

        self.agent.transfer_erc20_from_mainnet_to_schain(self.erc20,
                                                         self.config.mainnet_key,
                                                         self.config.schain_key,
                                                         self.amount,
                                                         self.timeout)
        sleep( 5 )

        amount_of_eth = 90 * 10 ** 15

        self.agent.transfer_eth_from_mainnet_to_schain(self.config.mainnet_key,
                                                       self.config.schain_key,
                                                       amount_of_eth,
                                                       self.timeout)
        sleep( 5 )

        self.erc20_clone = self.blockchain.get_erc20_on_schain("Mainnet", self.erc20.address)

    def _execute(self):
        source_address = self.blockchain.key_to_address(self.config.mainnet_key)
        destination_address = self.blockchain.key_to_address(self.config.mainnet_key)

        if self.erc20_clone.functions.balanceOf(source_address).call() < self.amount:
            error("Not enough tokens to send")
            return
        balance = self.erc20.functions.balanceOf(destination_address).call()

        self.agent.transfer_erc20_from_schain_to_mainnet(
            self.erc20_clone, # token
            self.erc20, # token on mainnet
            self.config.mainnet_key, # from
            self.config.schain_key, # to
            (self.amount - 2), # 2 tokens
            6 * 10 ** 16,
            self.timeout
        )

        # if self.erc20.functions.balanceOf(destination_address).call() == balance + self.amount:
        if self.erc20.functions.balanceOf(destination_address).call() == (self.amount - 2):
            self._mark_passed()


test_pool.register_test(SendERC20ToMainnet)
