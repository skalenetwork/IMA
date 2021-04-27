import json
import os

from .contracts.proxy_admin import ProxyAdminGenerator


def generate_contracts(owner_address: str) -> dict:
    proxy_admin = ProxyAdminGenerator(owner_address)

    return {
        '0xd2aAa00000000000000000000000000000000000': proxy_admin.generate_contract()
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
