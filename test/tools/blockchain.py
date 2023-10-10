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
from time import sleep

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
        deposit_box_eth = self._get_contract_on_mainnet('deposit_box_eth')
        return deposit_box_eth.functions.approveTransfers(address).call()

    def enableAutomaticDeployERC20(self, from_key, schainName):
        sender_address = self.key_to_address(from_key)
        token_manager_erc20 = self._get_contract_on_schain('token_manager_erc20')
        enable = token_manager_erc20.encodeABI(fn_name="enableAutomaticDeploy", args=[])
        signed_txn = self.web3_schain.eth.account.signTransaction(dict(
                nonce=self.web3_schain.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_schain.eth.gasPrice,
                gas=200000,
                to=token_manager_erc20.address,
                value=0,
                data = enable
            ),
            from_key)
        self.web3_schain.eth.sendRawTransaction(signed_txn.rawTransaction)

    def enableAutomaticDeployERC721(self, from_key, schainName):
        sender_address = self.key_to_address(from_key)
        token_manager_erc721 = self._get_contract_on_schain('token_manager_erc721')
        enable = token_manager_erc721.encodeABI(fn_name="enableAutomaticDeploy", args=[])
        signed_txn = self.web3_schain.eth.account.signTransaction(dict(
                nonce=self.web3_schain.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_schain.eth.gasPrice,
                gas=200000,
                to=token_manager_erc721.address,
                value=0,
                data = enable
            ),
            from_key)
        self.web3_schain.eth.sendRawTransaction(signed_txn.rawTransaction)

    def enableAutomaticDeployERC1155(self, from_key, schainName):
        sender_address = self.key_to_address(from_key)
        token_manager_erc1155 = self._get_contract_on_schain('token_manager_erc1155')
        enable = token_manager_erc1155.encodeABI(fn_name="enableAutomaticDeploy", args=[])
        signed_txn = self.web3_schain.eth.account.signTransaction(dict(
                nonce=self.web3_schain.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_schain.eth.gasPrice,
                gas=200000,
                to=token_manager_erc1155.address,
                value=0,
                data = enable
            ),
            from_key)
        self.web3_schain.eth.sendRawTransaction(signed_txn.rawTransaction)

    def disableWhitelistERC20(self, from_key, schainName):
        sender_address = self.key_to_address(from_key)
        deposit_box_erc20 = self._get_contract_on_mainnet('deposit_box_erc20')
        disable = deposit_box_erc20.encodeABI(fn_name="disableWhitelist", args=[schainName])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=deposit_box_erc20.address,
                value=0,
                data = disable
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def disableWhitelistERC721(self, from_key, schainName):
        sender_address = self.key_to_address(from_key)
        deposit_box_erc721 = self._get_contract_on_mainnet('deposit_box_erc721')
        disable = deposit_box_erc721.encodeABI(fn_name="disableWhitelist", args=[schainName])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=deposit_box_erc721.address,
                value=0,
                data = disable
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def disableWhitelistERC1155(self, from_key, schainName):
        sender_address = self.key_to_address(from_key)
        deposit_box_erc1155 = self._get_contract_on_mainnet('deposit_box_erc1155')
        disable = deposit_box_erc1155.encodeABI(fn_name="disableWhitelist", args=[schainName])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=deposit_box_erc1155.address,
                value=0,
                data = disable
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def addERC20TokenByOwner(self, from_key, schainName, erc20Address):
        sender_address = self.key_to_address(from_key)
        deposit_box_erc20 = self._get_contract_on_mainnet('deposit_box_erc20')
        disable = deposit_box_erc20.encodeABI(fn_name="addERC20TokenByOwner", args=[schainName, erc20Address])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=deposit_box_erc20.address,
                value=0,
                data = disable
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def addERC721TokenByOwner(self, from_key, schainName, erc20Address):
        sender_address = self.key_to_address(from_key)
        deposit_box_erc721 = self._get_contract_on_mainnet('deposit_box_erc721')
        disable = deposit_box_erc721.encodeABI(fn_name="addERC721TokenByOwner", args=[schainName, erc20Address])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=deposit_box_erc721.address,
                value=0,
                data = disable
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def addERC1155TokenByOwner(self, from_key, schainName, erc20Address):
        sender_address = self.key_to_address(from_key)
        deposit_box_erc1155 = self._get_contract_on_mainnet('deposit_box_erc1155')
        disable = deposit_box_erc1155.encodeABI(fn_name="addERC1155TokenByOwner", args=[schainName, erc20Address])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=deposit_box_erc1155.address,
                value=0,
                data = disable
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

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

    def recharge_user_wallet(self, from_key, schainName, amount_wei):
        sender_address = self.key_to_address(from_key)
        community_pool = self._get_contract_on_mainnet('community_pool')
        recharge_abi = community_pool.encodeABI(fn_name="rechargeUserWallet", args=[schainName, sender_address])
        signed_txn = self.web3_mainnet.eth.account.signTransaction(dict(
                nonce=self.web3_mainnet.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_mainnet.eth.gasPrice,
                gas=200000,
                to=community_pool.address,
                value=amount_wei,
                data = recharge_abi
            ),
            from_key)
        self.web3_mainnet.eth.sendRawTransaction(signed_txn.rawTransaction)

    def set_time_limit_per_message(self, from_key, time_limit):
        sender_address = self.key_to_address(from_key)
        community_locker = self._get_contract_on_schain('community_locker')
        time_limit_abi = community_locker.encodeABI(fn_name="setTimeLimitPerMessage", args=["Mainnet", time_limit])
        signed_txn = self.web3_schain.eth.account.signTransaction(dict(
                nonce=self.web3_schain.eth.getTransactionCount(sender_address),
                gasPrice=self.web3_schain.eth.gasPrice,
                gas=200000,
                to=community_locker.address,
                value=0,
                data=time_limit_abi
            ),
            from_key)
        self.web3_schain.eth.sendRawTransaction(signed_txn.rawTransaction)

    def deploy_erc20_on_mainnet(self, private_key, name, symbol, decimals):
        return self._deploy_contract_to_mainnet(self.config.test_root + '/resources/ERC20MintableDetailed.json',
                                                [name, symbol, decimals],
                                                private_key)
    def deploy_erc721_on_mainnet(self, private_key, name, symbol):
        return self._deploy_contract_to_mainnet(self.config.test_root + '/resources/ERC721FullMetadataMintable.json',
                                                [name, symbol],
                                                private_key)

    def deploy_erc1155_on_mainnet(self, private_key, uri):
        return self._deploy_contract_to_mainnet(self.config.test_root + '/resources/ERC1155BurnableMintable.json',
                                                [uri],
                                                private_key)

    def get_transactions_count_on_mainnet(self, address):
        return self.web3_mainnet.eth.getTransactionCount(address)

    def get_erc20_on_schain(self, schain_name, erc20_address_mainnet):
        lock_erc20 = self._get_contract_on_schain('token_manager_erc20')
        mainnet_hash = Web3.solidityKeccak(['string'], ["Mainnet"])
        erc20_address = lock_erc20.functions.clonesErc20(mainnet_hash, erc20_address_mainnet).call()
        if erc20_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.proxy_root + '/artifacts/contracts/schain/tokens/ERC20OnChain.sol/ERC20OnChain.json') as erc20_on_chain_file:
            erc20_on_chain_json = json.load(erc20_on_chain_file)
            return self.web3_schain.eth.contract(address=erc20_address, abi=erc20_on_chain_json['abi'])

    def get_erc721_on_schain(self, schain_name, erc721_address_mainnet):
        lock_erc721 = self._get_contract_on_schain('token_manager_erc721')
        mainnet_hash = Web3.solidityKeccak(['string'], ["Mainnet"])
        erc721_address = lock_erc721.functions.clonesErc721(mainnet_hash, erc721_address_mainnet).call()
        if erc721_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.proxy_root + '/artifacts/contracts/schain/tokens/ERC721OnChain.sol/ERC721OnChain.json') as erc721_on_chain_file:
            erc721_on_chain_json = json.load(erc721_on_chain_file)
            return self.web3_schain.eth.contract(address=erc721_address, abi=erc721_on_chain_json['abi'])

    def get_erc1155_on_schain(self, schain_name, erc1155_address_mainnet):
        lock_erc1155 = self._get_contract_on_schain('token_manager_erc1155')
        mainnet_hash = Web3.solidityKeccak(['string'], ["Mainnet"])
        erc1155_address = lock_erc1155.functions.clonesErc1155(mainnet_hash, erc1155_address_mainnet).call()
        if erc1155_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.proxy_root + '/artifacts/contracts/schain/tokens/ERC1155OnChain.sol/ERC1155OnChain.json') as erc1155_on_chain_file:
            erc1155_on_chain_json = json.load(erc1155_on_chain_file)
            return self.web3_schain.eth.contract(address=erc1155_address, abi=erc1155_on_chain_json['abi'])

    def get_erc20_on_mainnet(self, index):
        lock_erc20 = self._get_contract_on_mainnet('deposit_box_erc20')
        erc20_address = lock_erc20.functions.erc20Tokens(index).call()
        if erc20_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.test_resource_dir + '/ERC20MintableDetailed.json') as erc20_file:
            erc20_on_mainnet_json = json.load(erc20_file)
            return self.web3_schain.eth.contract(address=erc20_address, abi=erc20_on_mainnet_json['abi'])

    def get_erc721_on_mainnet(self, index):
        lock_erc721 = self._get_contract_on_mainnet('deposit_box_erc721')
        erc721_address = lock_erc721.functions.erc721Tokens(index).call()
        if erc721_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.test_resource_dir + '/ERC721FullMetadataMintable.json') as erc721_file:
            erc721_on_mainnet_json = json.load(erc721_file)
            return self.web3_schain.eth.contract(address=erc721_address, abi=erc721_on_mainnet_json['abi'])

    def get_erc1155_on_mainnet(self, index):
        lock_erc1155 = self._get_contract_on_mainnet('deposit_box_erc1155')
        erc1155_address = lock_erc1155.functions.erc1155Tokens(index).call()
        if erc1155_address == '0x0000000000000000000000000000000000000000':
            raise ValueError('No such token')
        with open(self.config.test_resource_dir + '/ERC1155BurnableMintable.json') as erc1155_file:
            erc1155_on_mainnet_json = json.load(erc1155_file)
            return self.web3_schain.eth.contract(address=erc1155_address, abi=erc1155_on_mainnet_json['abi'])

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
            sleep( timeout )
        return None

    @staticmethod
    def get_receipt(web3, tx):
        return web3.eth.getTransactionReceipt(tx)

    def _deploy_contract_to_mainnet(self, json_filename, constructor_arguments, private_key):
        return self._deploy_contract_from_json(self.web3_mainnet, json_filename, constructor_arguments, private_key)

