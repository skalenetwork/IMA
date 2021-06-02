from ima_predeployed.addresses import PROXY_ADMIN_ADDRESS
from tools import w3, load_abi


def check_proxy_admin(owner_address):
    proxy_admin = w3.eth.contract(address=PROXY_ADMIN_ADDRESS, abi=load_abi('ProxyAdmin.json'))
    assert proxy_admin.functions.owner().call() == owner_address
