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
        self._execute_command(
            'register',
            {
                'colors': None
            }
        )

    def start(self):
        if self.agent_service is None:
            self.agent_service = Popen(self._construct_command('loop'))
            debug(f'Agent process #{self.agent_service.pid}')

    def stop(self):
        if self.agent_service is not None:
            self.agent_service.terminate()
            self.agent_service = None

    def transfer_eth_from_mainnet_to_schain(self, from_key, to_key, amount_wei, timeout=0):
        destination_address = self.blockchain.key_to_address(from_key)
        balance, initial_balance = None, None
        start = time()
        if timeout > 0:
            balance = self.blockchain.get_balance_on_schain(destination_address)
            initial_balance = balance

        self._execute_command(
            'm2s-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'key-main-net': from_key,
                'colors': None
            }
        )

        if timeout > 0:
            while not balance == initial_balance + amount_wei:
                balance = self.blockchain.get_balance_on_schain(destination_address)

                if time() > start + timeout:
                    return
                else:
                    sleep( 1 )

    def transfer_eth_from_schain_to_mainnet(self, from_key, to_key, amount_wei, timeout=0):
        destination_address = self.blockchain.key_to_address(from_key)
        initial_approved, approved, balance, initial_balance = None, None, None, None
        start = time()
        if timeout > 0:
            approved = self.blockchain.get_approved_amount(destination_address)
            initial_approved = approved

        self._execute_command(
            's2m-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'key-s-chain': from_key,
                'key-main-net': to_key,
                'colors': None
            }
        )

        if timeout > 0:
            while not approved >= initial_approved + amount_wei - 6 * 10 ** 16:
                approved = self.blockchain.get_approved_amount(destination_address)
                debug(f'Approved: {approved}')

                if time() > start + timeout:
                    return
                else:
                    sleep( 1 )
            balance = self.blockchain.get_balance_on_mainnet(destination_address)
            initial_balance = balance
            start = time()
            debug(f'Initial balance: {initial_balance}')

        self._execute_command(
            's2m-receive',
            {
                'key-main-net': from_key,
                'colors': None
                }
            )

        if timeout > 0:
            approximate_gas_spends = 3 * 10 ** 15
            while not balance > initial_balance + approved - approximate_gas_spends:
                balance = self.blockchain.get_balance_on_mainnet(destination_address)
                debug(f'Balance: {balance}')

                if time() > start + timeout:
                    return
                else:
                    sleep( 1 )

    def transfer_erc20_from_mainnet_to_schain(self, token_contract, from_key, to_key, amount, amount_wei, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc20_config_filename = self.config.test_working_dir + '/erc20.json'
        self._create_path(erc20_config_filename)
        with open(erc20_config_filename, 'w') as erc20_file:
            json.dump(config_json, erc20_file)

        self._execute_command(
            'm2s-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'amount': amount,
                'key-main-net': from_key,
                'key-s-chain': to_key,
                'erc20-main-net': erc20_config_filename,
                'colors': None
            }
        )

        start = time()
        while time() < start + timeout if timeout > 0 else True:
            try:
                self.blockchain.get_erc20_on_schain("Mainnet", token_contract.address)
                return
            except ValueError:
                debug('Wait for erc20 deployment')
                sleep( 1 )

    def transfer_erc721_from_mainnet_to_schain(self, token_contract, from_key, to_key, token_id, amount_wei, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc721_config_filename = self.config.test_working_dir + '/erc721.json'
        self._create_path(erc721_config_filename)
        with open(erc721_config_filename, 'w') as erc721_file:
            json.dump(config_json, erc721_file)
        sleep( 5 )

        self._execute_command(
            'm2s-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'tid': token_id,
                'key-main-net': from_key,
                'key-s-chain': to_key,
                'erc721-main-net': erc721_config_filename,
                'colors': None
            }
        )

        start = time()
        while time() < start + timeout if timeout > 0 else True:
            try:
                self.blockchain.get_erc721_on_schain("Mainnet", token_contract.address)
                return
            except ValueError:
                debug('Wait for erc721 deployment')
                sleep( 1 )

    def transfer_erc1155_from_mainnet_to_schain(self, token_contract, from_key, to_key, token_id, token_amount, amount_wei, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc1155_config_filename = self.config.test_working_dir + '/erc1155.json'
        self._create_path(erc1155_config_filename)
        with open(erc1155_config_filename, 'w') as erc1155_file:
            json.dump(config_json, erc1155_file)
        sleep( 5 )

        self._execute_command(
            'm2s-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'tid': token_id,
                'amount': token_amount,
                'key-main-net': from_key,
                'key-s-chain': to_key,
                'erc1155-main-net': erc1155_config_filename,
                'colors': None
            }
        )

        start = time()
        while time() < start + timeout if timeout > 0 else True:
            try:
                self.blockchain.get_erc1155_on_schain("Mainnet", token_contract.address)
                return
            except ValueError:
                debug('Wait for erc1155 deployment')
                sleep( 1 )

    def transfer_erc1155_batch_from_mainnet_to_schain(self, token_contract, from_key, to_key, token_ids, token_amounts, amount_wei, timeout=0):
        config_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        erc1155_config_filename = self.config.test_working_dir + '/erc1155.json'
        self._create_path(erc1155_config_filename)
        with open(erc1155_config_filename, 'w') as erc1155_file:
            json.dump(config_json, erc1155_file)
        sleep( 5 )

        self._execute_command(
            'm2s-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'tids': str(token_ids).replace(' ', ''),
                'amounts': str(token_amounts).replace(' ', ''),
                'key-main-net': from_key,
                'key-s-chain': to_key,
                'erc1155-main-net': erc1155_config_filename,
                'colors': None
            }
        )

        start = time()
        while time() < start + timeout if timeout > 0 else True:
            try:
                self.blockchain.get_erc1155_on_schain("Mainnet", token_contract.address)
                return
            except ValueError:
                debug('Wait for erc1155 deployment')
                sleep( 1 )

    def transfer_erc20_from_schain_to_mainnet(self, token_contract, token_contract_on_mainnet, from_key, to_key, amount, amount_wei, timeout=0):
        config_schain_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        config_mainnet_json = {'token_address': token_contract_on_mainnet.address, 'token_abi': token_contract_on_mainnet.abi}
        erc20_clone_config_filename = self.config.test_working_dir + '/erc20_clone.json'
        erc20_config_filename = self.config.test_working_dir + '/erc20.json'
        self._create_path(erc20_clone_config_filename)
        self._create_path(erc20_config_filename)
        with open(erc20_clone_config_filename, 'w') as erc20_file:
            json.dump(config_schain_json, erc20_file)
        with open(erc20_config_filename, 'w') as erc20_file:
            json.dump(config_mainnet_json, erc20_file)

        destination_address = self.blockchain.key_to_address(from_key)
        erc20 = token_contract_on_mainnet
        balance = erc20.functions.balanceOf(destination_address).call()

        tx_count = self.blockchain.get_transactions_count_on_mainnet(destination_address)

        self._execute_command(
            's2m-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'amount': amount,
                'key-main-net': to_key,
                'key-s-chain': from_key,
                'erc20-main-net': erc20_config_filename,
                'erc20-s-chain': erc20_clone_config_filename,
                'colors': None
            }
        )

        start = time()
        while (time() < start + timeout if timeout > 0 else True) and \
                balance == erc20.functions.balanceOf(destination_address).call():
            debug('Wait for erc20 payment')
            sleep( 1 )

    def transfer_erc721_from_schain_to_mainnet(self, token_contract, token_contract_on_mainnet, from_key, to_key, token_id, amount_wei, timeout=0):
        config_schain_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        config_mainnet_json = {'token_address': token_contract_on_mainnet.address, 'token_abi': token_contract_on_mainnet.abi}
        erc721_clone_config_filename = self.config.test_working_dir + '/erc721_clone.json'
        erc721_config_filename = self.config.test_working_dir + '/erc721.json'
        self._create_path(erc721_clone_config_filename)
        self._create_path(erc721_config_filename)
        with open(erc721_clone_config_filename, 'w') as erc721_file:
            json.dump(config_schain_json, erc721_file)
        with open(erc721_config_filename, 'w') as erc721_file:
            json.dump(config_mainnet_json, erc721_file)

        erc721 = token_contract_on_mainnet
        destination_address = erc721.functions.ownerOf(token_id).call()
        tx_count = self.blockchain.get_transactions_count_on_mainnet(destination_address)
        sleep( 10 )
        self._execute_command(
            's2m-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'tid': token_id,
                'key-main-net': to_key,
                'key-s-chain': from_key,
                'erc721-main-net': erc721_config_filename,
                'erc721-s-chain': erc721_clone_config_filename,
                'colors': None
            }
        )

        start = time()
        while (time() < start + timeout if timeout > 0 else True) and \
                destination_address == erc721.functions.ownerOf(token_id).call():
            debug('Wait for erc721 payment')
            sleep( 1 )

    def transfer_erc1155_from_schain_to_mainnet(self, token_contract, token_contract_on_mainnet, from_key, to_key, token_id, token_amount, amount_wei, timeout=0):
        config_schain_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        config_mainnet_json = {'token_address': token_contract_on_mainnet.address, 'token_abi': token_contract_on_mainnet.abi}
        erc1155_clone_config_filename = self.config.test_working_dir + '/erc1155_clone.json'
        erc1155_config_filename = self.config.test_working_dir + '/erc1155.json'
        self._create_path(erc1155_clone_config_filename)
        self._create_path(erc1155_config_filename)
        with open(erc1155_clone_config_filename, 'w') as erc1155_file:
            json.dump(config_schain_json, erc1155_file)
        with open(erc1155_config_filename, 'w') as erc1155_file:
            json.dump(config_mainnet_json, erc1155_file)

        erc1155 = token_contract_on_mainnet
        destination_address = self.blockchain.key_to_address(from_key)
        sleep( 10 )
        self._execute_command(
            's2m-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'tid': token_id,
                'amount': token_amount,
                'key-main-net': to_key,
                'key-s-chain': from_key,
                'erc1155-main-net': erc1155_config_filename,
                'erc1155-s-chain': erc1155_clone_config_filename,
                'colors': None
            }
        )

        start = time()
        while (time() < start + timeout if timeout > 0 else True) and \
                token_amount != erc1155.functions.balanceOf(destination_address, token_id).call():
            debug('Wait for erc1155 payment')
            sleep( 1 )

    def transfer_erc1155_batch_from_schain_to_mainnet(self, token_contract, token_contract_on_mainnet, from_key, to_key, token_ids, token_amounts, amount_wei, timeout=0):
        config_schain_json = {'token_address': token_contract.address, 'token_abi': token_contract.abi}
        config_mainnet_json = {'token_address': token_contract_on_mainnet.address, 'token_abi': token_contract_on_mainnet.abi}
        erc1155_clone_config_filename = self.config.test_working_dir + '/erc1155_clone.json'
        erc1155_config_filename = self.config.test_working_dir + '/erc1155.json'
        self._create_path(erc1155_clone_config_filename)
        self._create_path(erc1155_config_filename)
        with open(erc1155_clone_config_filename, 'w') as erc1155_file:
            json.dump(config_schain_json, erc1155_file)
        with open(erc1155_config_filename, 'w') as erc1155_file:
            json.dump(config_mainnet_json, erc1155_file)

        erc1155 = token_contract_on_mainnet
        destination_address = self.blockchain.key_to_address(from_key)
        sleep( 10 )
        self._execute_command(
            's2m-payment',
            {
                **self._wei_to_bigger(amount_wei),
                'tids': str(token_ids).replace(' ', ''),
                'amounts': str(token_amounts).replace(' ', ''),
                'key-main-net': to_key,
                'key-s-chain': from_key,
                'erc1155-main-net': erc1155_config_filename,
                'erc1155-s-chain': erc1155_clone_config_filename,
                'colors': None
            }
        )

        start = time()
        while (time() < start + timeout if timeout > 0 else True) and \
                token_amounts != erc1155.functions.balanceOfBatch([destination_address]*len(token_ids), token_ids).call():
            debug('Wait for erc1155 payment')
            sleep( 1 )

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
                f'{self.config.agent_root}/main.mjs'] + \
               [f'--{key}' + (f'={str(value)}' if value is not None else '') for key, value in flags.items() ]

    def _format_command(self, command, flags=None):
        if flags is None:
            flags = {}
        return ' '.join(self._construct_command(command, flags))

    def _get_default_flags(self):
        return {
            'verbose': 9,
            's2s-disable': None,
            'url-main-net': self.config.mainnet_rpc_url,
            'url-s-chain': self.config.schain_rpc_url,
            'id-main-net': 'Mainnet',
            'id-s-chain': self.config.schain_name,
            'abi-main-net': self.config.abi_mainnet,
            'abi-s-chain': self.config.abi_schain,
            'key-main-net': self.config.mainnet_key,
            'key-s-chain': self.config.schain_key,
            'no-wait-s-chain': None,
            'no-pwa': None,
            'gas-price-multiplier': '2.0',
            'gas-multiplier': '2.0',
            'colors': None,
            'no-expose': None,
            'no-expose-pwa': None,
            'no-expose-security-info': None,
            'no-gathered': None,
            'dynamic-log-in-transfer': None,
            'accumulated-log-in-bls-signer': None
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
