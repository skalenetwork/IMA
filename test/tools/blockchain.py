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

from web3 import Web3, HTTPProvider
import json
from eth_account import Account
import time

class BlockChain:
    config = None
    web3_mainnet = None
    web3_schain = None


    def __init__(self, config):
        self.config = config
        self.web3_mainnet = Web3(HTTPProvider(self.config.mainnet_rpc_url))
        self.web3_schain = Web3(HTTPProvider(self.config.schain_rpc_url))
        if not self.config.user_key:
            self.config.user_key = Account.create().privateKey.hex()[2:]

    def get_balance_on_schain(self, address):
        eth_token = self._get_contract_on_schain('eth_erc20')
        return eth_token.functions.balanceOf(address).call()

    def get_balance_on_mainnet(self, address):
        return self.web3_mainnet.eth.getBalance(address)

    @staticmethod
    def key_to_address(key):
        return Account.privateKeyToAccount(key).address

    def wei_to_bigger(self, amount):
        units = {'wei': 1,
                 'babbage': 10 ** 3,
                 'lovelace': 10 ** 6,
                 'shannon': 10 ** 9,
                 'szabo': 10 ** 12,
                 'finney': 10 ** 15,
                 'ether': 10 ** 18}

        unit_name, new_amount = 'wei', amount
        for unit, value in units.items():
            if amount % value == 0:
                if amount // value < new_amount:
                    unit_name = unit
                    new_amount = amount // value
        return new_amount, unit_name

    def get_approved_amount(self, address):
        lock_and_data_for_mainnet = self._get_contract_on_mainnet('lock_and_data_for_mainnet')
        return lock_and_data_for_mainnet.functions.approveTransfers(address).call()

    def add_eth_cost(self, from_key, amount):
        sender_address = self.key_to_address(from_key)
        token_manager = self._get_contract_on_schain('token_manager')
        add_eth_cost_encode_abi = token_manager.encodeABI(fn_name="addEthCostWithoutAddress", args=[amount])
        signed_txn = self.web3_schain.eth.account.signTransaction(dict(
                nonce=self.web3_schain.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_schain.eth.gasPrice,
                gas=200000,
                to=token_manager.address,
                value=0,
                data = add_eth_cost_encode_abi
            ),
            from_key)
        self.web3_schain.eth.sendRawTransaction(signed_txn.rawTransaction)

    def send_ether_on_mainnet(self, from_key, to_key, amount_wei):
        sender_address = self.key_to_address(from_key)
        recipient_address = self.key_to_address(to_key)
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=100000,
                to=recipient_address,
                value=amount_wei
            ),
            from_key)

        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def deploy_erc20_on_mainnet(self, private_key, name, symbol, decimals):
        return self._deploy_contract_to_mainnet(self.config.test_root + '/resources/ERC20MintableDetailed.json',
                                                [name, symbol, decimals],
                                                private_key)
    def deploy_erc721_on_mainnet(self, private_key, name, symbol):
        return self._deploy_contract_to_mainnet(self.config.test_root + '/resources/ERC721FullMetadataMintable.json',
                                                [name, symbol],
                                                private_key)

    def get_transactions_count_on_mainnet(self, address):
        return self.web3_mainnet.eth.getTransactionCount(address)

    def get_erc20_on_schain(self, index):
        lock_erc20 = self._get_contract_on_schain('lock_and_data_for_schain_erc20')
        erc20_address = lock_erc20.functions.erc20Tokens(index).call()
        if erc20_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.proxy_root + '/build/contracts/ERC20OnChain.json') as erc20_on_chain_file:
            erc20_on_chain_json = json.load(erc20_on_chain_file)
            return self.web3_schain.eth.contract(address=erc20_address, abi=erc20_on_chain_json['abi'])

    def get_erc721_on_schain(self, index):
        lock_erc721 = self._get_contract_on_schain('lock_and_data_for_schain_erc721')
        erc721_address = lock_erc721.functions.erc721Tokens(index).call()
        if erc721_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.proxy_root + '/build/contracts/ERC721OnChain.json') as erc721_on_chain_file:
            erc721_on_chain_json = json.load(erc721_on_chain_file)
            return self.web3_schain.eth.contract(address=erc721_address, abi=erc721_on_chain_json['abi'])

    def get_erc20_on_mainnet(self, index):
        lock_erc20 = self._get_contract_on_mainnet('lock_and_data_for_mainnet_erc20')
        erc20_address = lock_erc20.functions.erc20Tokens(index).call()
        if erc20_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.test_resource_dir + '/ERC20MintableDetailed.json') as erc20_file:
            erc20_on_mainnet_json = json.load(erc20_file)
            return self.web3_schain.eth.contract(address=erc20_address, abi=erc20_on_mainnet_json['abi'])

    def get_erc721_on_mainnet(self, index):
        lock_erc721 = self._get_contract_on_mainnet('lock_and_data_for_mainnet_erc721')
        erc721_address = lock_erc721.functions.erc721Tokens(index).call()
        if erc721_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.test_resource_dir + '/ERC721FullMetadataMintable.json') as erc721_file:
            erc721_on_mainnet_json = json.load(erc721_file)
            return self.web3_schain.eth.contract(address=erc721_address, abi=erc721_on_mainnet_json['abi'])

    # private

    def _get_contact(self, web3, json_filename, name):
        with open(json_filename) as abi_file:
            abis = json.load(abi_file)
        contract = web3.eth.contract(
            address=abis[name + '_address'],
            abi=abis[name + '_abi']
        )
        return contract

    def _get_contract_on_schain(self, name):
        return self._get_contact(self.web3_schain, self.config.abi_schain, name)

    def _get_contract_on_mainnet(self, name):
        return self._get_contact(self.web3_mainnet, self.config.abi_mainnet, name)

    @staticmethod
    def _deploy_contract_from_json(web3, json_filename, constructor_arguments, private_key):
        with open(json_filename) as json_file:
            address = BlockChain.key_to_address(private_key)

            json_contract = json.load(json_file)
            abi = json_contract['abi']
            bytecode = json_contract['bytecode']
            contract = web3.eth.contract(abi=abi, bytecode=bytecode)

            nonce = web3.eth.getTransactionCount(address)

            deploy_txn = contract.constructor(*constructor_arguments).buildTransaction({
                'gas': 4712388,
                'gasPrice': web3.toWei('1', 'gwei'),
                'nonce': nonce,
            })
            signed_txn = web3.eth.account.signTransaction(deploy_txn, private_key=private_key)
            transaction_hash = web3.eth.sendRawTransaction(signed_txn.rawTransaction)
            #
            receipt = BlockChain.await_receipt(web3, transaction_hash)
            #
            contract = web3.eth.contract(address=receipt.contractAddress, abi=abi)
            return contract

    @staticmethod
    def await_receipt(web3, tx, retries=10, timeout=5):
        for _ in range(0, retries):
            receipt = BlockChain.get_receipt(web3, tx)
            if (receipt != None):
                return receipt
            time.sleep(timeout)
        return None

    @staticmethod
    def get_receipt(web3, tx):
        return web3.eth.getTransactionReceipt(tx)

    def _deploy_contract_to_mainnet(self, json_filename, constructor_arguments, private_key):
        return self._deploy_contract_from_json(self.web3_mainnet, json_filename, constructor_arguments, private_key)

