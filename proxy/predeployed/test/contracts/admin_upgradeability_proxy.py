from ima_predeployed.addresses import PROXY_ADMIN_ADDRESS, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS
from tools import w3, load_abi


def check_admin_upgradeability_proxy():
    proxy_admin = w3.eth.contract(address=PROXY_ADMIN_ADDRESS, abi=load_abi('ProxyAdmin.json'))
    if not proxy_admin.functions.getProxyAdmin(MESSAGE_PROXY_FOR_SCHAIN_ADDRESS).call() == PROXY_ADMIN_ADDRESS: raise AssertionError
    if not proxy_admin.functions.getProxyImplementation(
        MESSAGE_PROXY_FOR_SCHAIN_ADDRESS).call() == MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS: raise AssertionError
