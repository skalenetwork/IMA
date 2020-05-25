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

import errno
from time import time, sleep
from subprocess import Popen
from logging import debug
import json
import os

from tools.blockchain import BlockChain
from tools.utils import execute


class Agent:
    config = None
    started = False
    agent_service = None
    blockchain = None

    def __init__(self, config):
        self.config = config
        self.blockchain = BlockChain(config)

    def register(self):
        self._execute_command('register')

    def start(self):
        if self.agent_service is None:
            self.agent_service = Popen(self._construct_command('loop'))
            debug(f'Agent process #{self.agent_service.pid}')

    def stop(self):
        if self.agent_service is not None:
            self.agent_service.terminate()
            self.agent_service = None

    def transfer_eth_from_mainnet_to_schain(self, from_key, to_key, amount_wei, timeout=0):
        destination_address = self.blockchain.key_to_address(to_key)
        balance, initial_balance = None, None
        start = time()
        if timeout > 0:
            balance = self.blockchain.get_balance_on_schain(destination_address)
            initial_balance = balance

        self._execute_command('m2s-payment', {**self._wei_to_bigger(amount_wei), 'key-main-net': from_key})

        if timeout > 0:
            while not balance == initial_balance + amount_wei:
                balance = self.blockchain.get_balance_on_schain(destination_address)

                if time() > start + timeout:
                    return
                else:
                    sleep(1)

    def transfer_eth_from_schain_to_mainnet(self, from_key, to_key, amount_wei, timeout=0):
        transaction_fee = 2 * 10 ** 15
        destination_address = self.blockchain.key_to_address(to_key)
        initial_approved, approved, balance, initial_balance = None, None, None, None
        start = time()
        if timeout > 0:
            approved = self.blockchain.get_approved_amount(destination_address)
            initial_approved = approved

        self._execute_command('s2m-payment', {**self._wei_to_bigger(amount_wei),
                                              'key-s-chain': from_key,
                                              'key-main-net': to_key})

        if timeout > 0:
            while not approved == initial_approved + amount_wei - transaction_fee:
                approved = self.blockchain.get_approved_amount(destination_address)
                debug(f'Approved: {approved}')

                if time() > start + timeout:
                    return
                else:
                    sleep(1)
            balance = self.blockchain.get_balance_on_mainnet(destination_address)
            initial_balance = balance
            start = time()
            debug(f'Initial balance: {initial_balance}')

        self._execute_command('s2m-receive', {'key-main-net': to_key})

        if timeout > 0:
            approximate_gas_spends = 21 * 10 ** 13
            while not balance > initial_balance + approved - approximate_gas_spends:
                balance = self.blockchain.get_balance_on_mainnet(destination_address)
                debug(f'Balance: {balance}')

                if time() > start + timeout:
                    return
                else:
                    sleep(1)

    def transfer_erc20_from_mainnet_to_schain(self, token_contract, from_key, to_key, amount, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc20_config_filename = self.config.test_working_dir + '/erc20.json'
        self._create_path(erc20_config_filename)
        with open(erc20_config_filename, 'w') as erc20_file:
            json.dump(config_json, erc20_file)

        self._execute_command('m2s-payment', {'no-raw-transfer': None,
                                              'amount': amount,
                                              'key-main-net': from_key,
                                              'key-s-chain': to_key,
                                              'erc20-main-net': erc20_config_filename})

        start = time()
        while time() < start + timeout if timeout > 0 else True:
            try:
                self.blockchain.get_erc20_on_schain(1)
                return
            except ValueError:
                debug('Wait for erc20 deployment')
                sleep(1)

    def transfer_erc721_from_mainnet_to_schain(self, token_contract, from_key, to_key, token_id, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc721_config_filename = self.config.test_working_dir + '/erc721.json'
        self._create_path(erc721_config_filename)
        with open(erc721_config_filename, 'w') as erc721_file:
            json.dump(config_json, erc721_file)
        sleep(5)

        self._execute_command('m2s-payment', {'no-raw-transfer': None,
                                              'tid': token_id,
                                              'key-main-net': from_key,
                                              'key-s-chain': to_key,
                                              'erc721-main-net': erc721_config_filename})

        start = time()
        while time() < start + timeout if timeout > 0 else True:
            try:
                self.blockchain.get_erc721_on_schain(token_id)
                return
            except ValueError:
                debug('Wait for erc721 deployment')
                sleep(1)

    def transfer_erc20_from_schain_to_mainnet(self, token_contract, from_key, to_key, amount, index, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc20_clone_config_filename = self.config.test_working_dir + '/erc20_clone.json'
        self._create_path(erc20_clone_config_filename)
        with open(erc20_clone_config_filename, 'w') as erc20_file:
            json.dump(config_json, erc20_file)

        destination_address = self.blockchain.key_to_address(to_key)
        erc20 = self.blockchain.get_erc20_on_mainnet(index)
        balance = erc20.functions.balanceOf(destination_address).call()
        # balance = erc20.functions.balanceOf(destination_address)

        tx_count = self.blockchain.get_transactions_count_on_mainnet(destination_address)

        self._execute_command('s2m-payment', {'no-raw-transfer': None,
                                              'amount': amount,
                                              'key-main-net': to_key,
                                              'key-s-chain': from_key,
                                              'erc20-s-chain': erc20_clone_config_filename})
        # sleep(30)

        start = time()
        while (time() < start + timeout if timeout > 0 else True) and \
                balance == erc20.functions.balanceOf(destination_address).call():
            debug('Wait for erc20 payment')
            sleep(1)
        # start = time()
        # while (time() < start + timeout if timeout > 0 else True) and \
        #         self.blockchain.get_transactions_count_on_mainnet(destination_address) == tx_count:
        #     debug('Wait for erc20 payment')
        #     sleep(1)

    def transfer_erc721_from_schain_to_mainnet(self, token_contract, from_key, to_key, token_id, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc721_clone_config_filename = self.config.test_working_dir + '/erc721_clone.json'
        self._create_path(erc721_clone_config_filename)
        with open(erc721_clone_config_filename, 'w') as erc721_file:
            json.dump(config_json, erc721_file)

        erc721 = self.blockchain.get_erc721_on_mainnet(token_id)
        destination_address = erc721.functions.ownerOf(token_id).call()
        # destination_address = self.blockchain.key_to_address(to_key)
        tx_count = self.blockchain.get_transactions_count_on_mainnet(destination_address)
        sleep(10)
        self._execute_command('s2m-payment', {'no-raw-transfer': None,
                                              'tid': token_id,
                                              'key-main-net': to_key,
                                              'key-s-chain': from_key,
                                              'erc721-s-chain': erc721_clone_config_filename})

        start = time()
        while (time() < start + timeout if timeout > 0 else True) and \
                destination_address == erc721.functions.ownerOf(token_id).call():
            debug('Wait for erc721 payment')
            sleep(1)
        # start = time()
        # while (time() < start + timeout if timeout > 0 else True) and \
        #         self.blockchain.get_transactions_count_on_mainnet(destination_address) == tx_count:
        #     debug('Wait for erc721 payment')
        #     sleep(1)

    # private

    def _execute_command(self, command, flags=None):
        if flags is None:
            flags = {}
        execute(self._format_command(command, flags))

    def _construct_command(self, command, flags=None):
        if flags is None:
            flags = {}
        flags = {**self._get_default_flags(), command: None, **flags}

        return ['node',
                f'{self.config.agent_root}/main.js'] + \
               [f'--{key}' + (f'={str(value)}' if value is not None else '') for key, value in flags.items() ]

    def _format_command(self, command, flags=None):
        if flags is None:
            flags = {}
        return ' '.join(self._construct_command(command, flags))

    def _get_default_flags(self):
        return {
            'verbose': 9,
            'url-main-net': self.config.mainnet_rpc_url,
            'url-s-chain': self.config.schain_rpc_url,
            'id-main-net': 'Mainnet',
            'id-s-chain': self.config.schain_name,
            'abi-main-net': self.config.abi_mainnet,
            'abi-s-chain': self.config.abi_schain,
            'key-main-net': self.config.mainnet_key,
            'key-s-chain': self.config.schain_key
        }

    def _wei_to_bigger(self, amount):
        new_amount, unit = self.blockchain.wei_to_bigger(amount)
        return {unit: new_amount}

    @staticmethod
    def _create_path(filename):
        if not os.path.exists(os.path.dirname(filename)):
            try:
                os.makedirs(os.path.dirname(filename))
            except OSError as exc:  # Guard against race condition
                if exc.errno != errno.EEXIST:
                    raise
