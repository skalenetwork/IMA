import json
import os

from predeployed_generator.openzeppelin.proxy_admin_generator import ProxyAdminGenerator

from .contract_generator import ContractGenerator
from .contracts.eth_erc20 import UpgradeableEthErc20Generator
from .contracts.token_manager_erc20 import UpgradeableTokenManagerErc20Generator
from .contracts.token_manager_erc721 import UpgradeableTokenManagerErc721Generator
from .contracts.token_manager_erc1155 import UpgradeableTokenManagerErc1155Generator
from .contracts.token_manager_erc721_with_metadata import (
    UpgradeableTokenManagerErc721WithMetadataGenerator as UpgradeableTokenManagerErc721WMGenerator
)
from .contracts.token_manager_eth import UpgradeableTokenManagerEthGenerator
from .contracts.token_manager_linker import UpgradeableTokenManagerLinkerGenerator
from .contracts.community_locker import UpgradeableCommunityLockerGenerator
from .contracts.key_storage import UpgradeableKeyStorageGenerator
from .contracts.message_proxy_for_schain import UpgradeableMessageProxyForSchainGenerator
from .addresses import (
    PROXY_ADMIN_ADDRESS, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS, KEY_STORAGE_IMPLEMENTATION_ADDRESS,
    KEY_STORAGE_ADDRESS, COMMUNITY_LOCKER_IMPLEMENTATION_ADDRESS, COMMUNITY_LOCKER_ADDRESS,
    TOKEN_MANAGER_ERC1155_ADDRESS, TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS,
    TOKEN_MANAGER_LINKER_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS,
    TOKEN_MANAGER_ETH_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS,
    TOKEN_MANAGER_ERC20_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS,
    TOKEN_MANAGER_ERC721_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS, ETH_ERC20_IMPLEMENTATION_ADDRESS,
    ETH_ERC20_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS
)


def generate_contracts(
        owner_address: str,
        schain_name: str,
        contracts_on_mainnet: dict) -> dict:
    proxy_admin = ProxyAdminGenerator.generate_storage(
        contract_address=PROXY_ADMIN_ADDRESS,
        owner_address=owner_address
    )

    message_proxy_for_schain = UpgradeableMessageProxyForSchainGenerator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
        implementation_address=MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name
    )

    key_storage = UpgradeableKeyStorageGenerator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=KEY_STORAGE_ADDRESS,
        implementation_address=KEY_STORAGE_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address
    )

    community_locker = UpgradeableCommunityLockerGenerator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=COMMUNITY_LOCKER_ADDRESS,
        implementation_address=COMMUNITY_LOCKER_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name,
        community_pool_address=contracts_on_mainnet['community_pool_address']
    )

    token_manager_linker = UpgradeableTokenManagerLinkerGenerator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=TOKEN_MANAGER_LINKER_ADDRESS,
        implementation_address=TOKEN_MANAGER_LINKER_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        community_pool_address=contracts_on_mainnet['linker_address']
    )

    token_manager_eth = UpgradeableTokenManagerEthGenerator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=TOKEN_MANAGER_ETH_ADDRESS,
        implementation_address=TOKEN_MANAGER_ETH_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name,
        community_pool_address=contracts_on_mainnet['deposit_box_eth_address']
    )

    token_manager_erc20 = UpgradeableTokenManagerErc20Generator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=TOKEN_MANAGER_ERC20_ADDRESS,
        implementation_address=TOKEN_MANAGER_ERC20_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name,
        community_pool_address=contracts_on_mainnet['deposit_box_erc20_address']
    )

    token_manager_erc721 = UpgradeableTokenManagerErc721Generator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=TOKEN_MANAGER_ERC721_ADDRESS,
        implementation_address=TOKEN_MANAGER_ERC721_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name,
        community_pool_address=contracts_on_mainnet['deposit_box_erc721_address']
    )

    token_manager_erc1155 = UpgradeableTokenManagerErc1155Generator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=TOKEN_MANAGER_ERC1155_ADDRESS,
        implementation_address=TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name,
        community_pool_address=contracts_on_mainnet['deposit_box_erc1155_address']
    )

    token_manager_erc1155_wm = UpgradeableTokenManagerErc721WMGenerator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS,
        implementation_address=TOKEN_MANAGER_ERC721_WITH_METADATA_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address,
        schain_name=schain_name,
        community_pool_address=contracts_on_mainnet['deposit_box_erc721_with_metadata_address']
    )

    eth_erc20 = UpgradeableEthErc20Generator().generate_storage(
        admin_address=PROXY_ADMIN_ADDRESS,
        contract_address=ETH_ERC20_ADDRESS,
        implementation_address=ETH_ERC20_IMPLEMENTATION_ADDRESS,
        owner_address=owner_address
    )

    return {
        **proxy_admin,
        **message_proxy_for_schain,
        **key_storage,
        **community_locker,
        **token_manager_linker,
        **token_manager_eth,
        **token_manager_erc20,
        **token_manager_erc721,
        **token_manager_erc1155,
        **token_manager_erc1155_wm,
        **eth_erc20
    }


def generate_abi_key(name: str, address: str, abi: list) -> dict:
    return {
        name + '_address': address,
        name + '_abi': abi
    }


def generate_abi() -> dict:
    return {
        **generate_abi_key(
            'proxy_admin',
            PROXY_ADMIN_ADDRESS,
            ProxyAdminGenerator().get_abi()),
        **generate_abi_key(
            'message_proxy_chain',
            MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
            UpgradeableMessageProxyForSchainGenerator().get_abi()),
        **generate_abi_key(
            'key_storage',
            KEY_STORAGE_ADDRESS,
            UpgradeableKeyStorageGenerator().get_abi()),
        **generate_abi_key(
            'community_locker',
            COMMUNITY_LOCKER_ADDRESS,
            UpgradeableCommunityLockerGenerator().get_abi()),
        **generate_abi_key(
            'token_manager_linker',
            TOKEN_MANAGER_LINKER_ADDRESS,
            UpgradeableTokenManagerLinkerGenerator().get_abi()),
        **generate_abi_key(
            'token_manager_eth',
            TOKEN_MANAGER_ETH_ADDRESS,
            UpgradeableTokenManagerEthGenerator().get_abi()),
        **generate_abi_key(
            'token_manager_erc20',
            TOKEN_MANAGER_ERC20_ADDRESS,
            UpgradeableTokenManagerErc20Generator().get_abi()),
        **generate_abi_key(
            'token_manager_erc721',
            TOKEN_MANAGER_ERC721_ADDRESS,
            UpgradeableTokenManagerErc721Generator().get_abi()),
        **generate_abi_key(
            'token_manager_erc1155',
            TOKEN_MANAGER_ERC1155_ADDRESS,
            UpgradeableTokenManagerErc1155Generator().get_abi()),
        **generate_abi_key(
            'token_manager_erc721_with_metadata',
            TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS,
            UpgradeableTokenManagerErc721WMGenerator().get_abi()),
        **generate_abi_key(
            'eth_erc20',
            ETH_ERC20_ADDRESS,
            UpgradeableTokenManagerErc20Generator().get_abi()),
        **{
            'ERC20OnChain_abi': ContractGenerator('ERC20OnChain.json').abi,
            'ERC721OnChain_abi': ContractGenerator('ERC721OnChain.json').abi,
            'ERC1155OnChain_abi': ContractGenerator('ERC1155OnChain.json').abi
        }
    }


def main() -> None:
    contracts_dir = os.path.join(os.path.dirname(__file__), 'artifacts')
    proxy_admin_path = os.path.join(contracts_dir, 'ProxyAdmin.json')    
    with open(proxy_admin_path, encoding='utf-8') as fp:
        proxy_admin = json.load(fp)
        print(proxy_admin['contractName'])


if __name__ == '__main__':
    main()
