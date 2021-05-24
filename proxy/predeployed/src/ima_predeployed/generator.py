import json
import os

from .contract_generator import ContractGenerator
from .contracts.key_storage import KeyStorageGenerator
from .upgradeable_contract_generator import UpgradeableContractGenerator
from .contracts.proxy_admin import ProxyAdminGenerator
from .contracts.admin_upgradeability_proxy import AdminUpgradeabilityProxyGenerator
from .contracts.message_proxy_for_schain import MessageProxyForSchainGenerator
from .addresses import \
    PROXY_ADMIN_ADDRESS, \
    MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS, KEY_STORAGE_IMPLEMENTATION_ADDRESS, KEY_STORAGE_ADDRESS


def generate_contracts(owner_address: str) -> dict:
    proxy_admin = ProxyAdminGenerator(owner_address)

    message_proxy_for_schain_implementation = ContractGenerator(MessageProxyForSchainGenerator.ARTIFACT_FILENAME)
    message_proxy_for_schain = UpgradeableContractGenerator(
        MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        MessageProxyForSchainGenerator(owner_address))

    key_storage_implementation = ContractGenerator(KeyStorageGenerator.ARTIFACT_FILENAME)
    key_storage = UpgradeableContractGenerator(
        KEY_STORAGE_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        KeyStorageGenerator(owner_address))

    return {
        PROXY_ADMIN_ADDRESS: proxy_admin.generate_contract(),

        MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: message_proxy_for_schain.generate_contract(),
        MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS: message_proxy_for_schain_implementation.generate_contract(),

        KEY_STORAGE_ADDRESS: key_storage.generate_contract(),
        KEY_STORAGE_IMPLEMENTATION_ADDRESS: key_storage_implementation.generate_contract()
    }


def main() -> None:
    contracts_dir = os.path.join(os.path.dirname(__file__), 'artifacts')
    proxy_admin_path = os.path.join(contracts_dir, 'ProxyAdmin.json')    
    with open(proxy_admin_path, encoding='utf-8') as fp:
        proxy_admin = json.load(fp)
        print(proxy_admin['contractName'])


if __name__ == '__main__':
    main()
