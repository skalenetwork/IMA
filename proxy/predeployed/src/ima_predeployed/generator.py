import json
import os

from .contracts.proxy_admin import ProxyAdminGenerator
from .contracts.admin_upgradeability_proxy import AdminUpgradeabilityProxyGenerator
from .contracts.message_proxy_for_schain import MessageProxyForSchainGenerator
from .addresses import \
    PROXY_ADMIN_ADDRESS,\
    MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,\
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS


def generate_contracts(owner_address: str) -> dict:
    proxy_admin = ProxyAdminGenerator(owner_address)
    message_proxy_for_schain_implementation = MessageProxyForSchainGenerator(owner_address)
    message_proxy_for_schain = AdminUpgradeabilityProxyGenerator(
        MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS, PROXY_ADMIN_ADDRESS)

    return {
        PROXY_ADMIN_ADDRESS: proxy_admin.generate_contract(),
        MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: message_proxy_for_schain.generate_contract(),
        MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS: message_proxy_for_schain_implementation.generate_contract()
    }


def main() -> None:
    print("Before import")
    print(__file__)

    contracts_dir = os.path.join(os.path.dirname(__file__), 'artifacts')
    proxy_admin_path = os.path.join(contracts_dir, 'ProxyAdmin.json')    
    with open(proxy_admin_path, encoding='utf-8') as fp:
        proxy_admin = json.load(fp)
        print(proxy_admin['contractName'])


if __name__ == '__main__':
    main()
