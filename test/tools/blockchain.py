from web3 import Web3, HTTPProvider
import json
from eth_account import Account


class BlockChain:
    config = None
    web3_mainnet = None
    web3_schain = None


    def __init__(self, config):
        self.config = config
        self.web3_mainnet = Web3(HTTPProvider(self.config.mainnet_rpc_url))
        self.web3_schain = Web3(HTTPProvider(self.config.schain_rpc_url))

    def get_balance_on_schain(self, address):
        eth_token = self._get_contract_on_schain('eth_erc20')
        return eth_token.functions.balanceOf(address).call()

    def get_balance_on_mainnet(self, address):
        return self.web3_mainnet.eth.getBalance(address)

    def key_to_address(self, key):
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