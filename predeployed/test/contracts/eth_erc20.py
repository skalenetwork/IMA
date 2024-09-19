from ima_predeployed.addresses import ETH_ERC20_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS
from ima_predeployed.contracts.eth_erc20 import EthErc20Generator
from tools import load_abi, w3


def check_eth_erc20(owner_address):
    eth_erc20 = w3.eth.contract(address=ETH_ERC20_ADDRESS, abi=load_abi(EthErc20Generator.ARTIFACT_FILENAME))
    if not eth_erc20.functions.getRoleMember(EthErc20Generator.DEFAULT_ADMIN_ROLE, 0).call() == owner_address: raise AssertionError
    if not eth_erc20.functions.hasRole(EthErc20Generator.DEFAULT_ADMIN_ROLE, owner_address).call(): raise AssertionError
    if not eth_erc20.functions.getRoleMember(EthErc20Generator.MINTER_ROLE, 0).call() == TOKEN_MANAGER_ETH_ADDRESS: raise AssertionError
    if not eth_erc20.functions.hasRole(EthErc20Generator.MINTER_ROLE, TOKEN_MANAGER_ETH_ADDRESS).call(): raise AssertionError
    if not eth_erc20.functions.getRoleMember(EthErc20Generator.BURNER_ROLE, 0).call() == TOKEN_MANAGER_ETH_ADDRESS: raise AssertionError
    if not eth_erc20.functions.hasRole(EthErc20Generator.BURNER_ROLE, TOKEN_MANAGER_ETH_ADDRESS).call(): raise AssertionError
    if not eth_erc20.functions.name().call() == EthErc20Generator.NAME: raise AssertionError
    if not eth_erc20.functions.symbol().call() == EthErc20Generator.SYMBOL: raise AssertionError
    if not eth_erc20.functions.decimals().call() == EthErc20Generator.DECIMALS: raise AssertionError
