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

    def key_to_address(self, key):
        return Account.privateKeyToAccount(key).address

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