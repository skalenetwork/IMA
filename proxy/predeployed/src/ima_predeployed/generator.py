import json
import os

from ima_predeployed.contracts.eth_erc20 import EthErc20Generator
from ima_predeployed.contracts.token_manager_erc20 import TokenManagerErc20Generator
from ima_predeployed.contracts.token_manager_erc721 import TokenManagerErc721Generator
from ima_predeployed.contracts.token_manager_erc1155 import TokenManagerErc1155Generator
from ima_predeployed.contracts.token_manager_erc721_with_metadata import TokenManagerErc721WithMetadataGenerator
from ima_predeployed.contracts.token_manager_eth import TokenManagerEthGenerator
from ima_predeployed.contracts.token_manager_linker import TokenManagerLinkerGenerator
from .contracts.community_locker import CommunityLockerGenerator
from .contract_generator import ContractGenerator
from .contracts.key_storage import KeyStorageGenerator
from .upgradeable_contract_generator import UpgradeableContractGenerator
from .contracts.proxy_admin import ProxyAdminGenerator
from .contracts.message_proxy_for_schain import MessageProxyForSchainGenerator
from .addresses import \
    PROXY_ADMIN_ADDRESS, \
    MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS, KEY_STORAGE_IMPLEMENTATION_ADDRESS, KEY_STORAGE_ADDRESS, \
    COMMUNITY_LOCKER_IMPLEMENTATION_ADDRESS, COMMUNITY_LOCKER_ADDRESS, \
    TOKEN_MANAGER_ERC1155_ADDRESS, TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_LINKER_IMPLEMENTATION_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS, TOKEN_MANAGER_ETH_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS, \
    TOKEN_MANAGER_ERC20_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS, \
    TOKEN_MANAGER_ERC721_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS, ETH_ERC20_IMPLEMENTATION_ADDRESS, \
    ETH_ERC20_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_IMPLEMENTATION_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS


def generate_contracts(
        owner_address: str,
        schain_name: str,
        contracts_on_mainnet: dict) -> dict:
    proxy_admin = ProxyAdminGenerator(owner_address)

    message_proxy_for_schain_implementation = ContractGenerator(MessageProxyForSchainGenerator.ARTIFACT_FILENAME)
    message_proxy_for_schain = UpgradeableContractGenerator(
        MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        MessageProxyForSchainGenerator(owner_address, schain_name))

    key_storage_implementation = ContractGenerator(KeyStorageGenerator.ARTIFACT_FILENAME)
    key_storage = UpgradeableContractGenerator(
        KEY_STORAGE_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        KeyStorageGenerator(owner_address))

    community_locker_implementation = ContractGenerator(CommunityLockerGenerator.ARTIFACT_FILENAME)
    community_locker = UpgradeableContractGenerator(
        COMMUNITY_LOCKER_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        CommunityLockerGenerator(owner_address, schain_name, contracts_on_mainnet['community_pool_address'])
    )

    token_manager_linker_implementation = ContractGenerator(TokenManagerLinkerGenerator.ARTIFACT_FILENAME)
    token_manager_linker = UpgradeableContractGenerator(
        TOKEN_MANAGER_LINKER_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerLinkerGenerator(owner_address, contracts_on_mainnet['linker_address'])
    )

    token_manager_eth_implementation = ContractGenerator(TokenManagerEthGenerator.ARTIFACT_FILENAME)
    token_manager_eth = UpgradeableContractGenerator(
        TOKEN_MANAGER_ETH_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerEthGenerator(owner_address, contracts_on_mainnet['deposit_box_eth_address'], schain_name)
    )

    token_manager_erc20_implementation = ContractGenerator(TokenManagerErc20Generator.ARTIFACT_FILENAME)
    token_manager_erc20 = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC20_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc20Generator(owner_address, contracts_on_mainnet['deposit_box_erc20_address'], schain_name)
    )

    token_manager_erc721_implementation = ContractGenerator(TokenManagerErc721Generator.ARTIFACT_FILENAME)
    token_manager_erc721 = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC721_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc721Generator(owner_address, contracts_on_mainnet['deposit_box_erc721_address'], schain_name)
    )

    token_manager_erc1155_implementation = ContractGenerator(TokenManagerErc1155Generator.ARTIFACT_FILENAME)
    token_manager_erc1155 = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc1155Generator(owner_address, contracts_on_mainnet['deposit_box_erc1155_address'], schain_name)
    )

    token_manager_erc721_with_metadata_implementation = ContractGenerator(TokenManagerErc721WithMetadataGenerator.ARTIFACT_FILENAME)
    token_manager_erc721_with_metadata = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC721_WITH_METADATA_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc721WithMetadataGenerator(owner_address, contracts_on_mainnet['deposit_box_erc721_with_metadata_address'], schain_name)
    )

    eth_erc20_implementation = ContractGenerator(EthErc20Generator.ARTIFACT_FILENAME)
    eth_erc20 = UpgradeableContractGenerator(
        ETH_ERC20_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        EthErc20Generator(owner_address)
    )

    return {
        PROXY_ADMIN_ADDRESS: proxy_admin.generate_contract(),

        MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: message_proxy_for_schain.generate_contract(),
        MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS: message_proxy_for_schain_implementation.generate_contract(),

        KEY_STORAGE_ADDRESS: key_storage.generate_contract(),
        KEY_STORAGE_IMPLEMENTATION_ADDRESS: key_storage_implementation.generate_contract(),

        COMMUNITY_LOCKER_ADDRESS: community_locker.generate_contract(),
        COMMUNITY_LOCKER_IMPLEMENTATION_ADDRESS: community_locker_implementation.generate_contract(),

        TOKEN_MANAGER_LINKER_ADDRESS: token_manager_linker.generate_contract(),
        TOKEN_MANAGER_LINKER_IMPLEMENTATION_ADDRESS: token_manager_linker_implementation.generate_contract(),

        TOKEN_MANAGER_ETH_ADDRESS: token_manager_eth.generate_contract(),
        TOKEN_MANAGER_ETH_IMPLEMENTATION_ADDRESS: token_manager_eth_implementation.generate_contract(),

        TOKEN_MANAGER_ERC20_ADDRESS: token_manager_erc20.generate_contract(),
        TOKEN_MANAGER_ERC20_IMPLEMENTATION_ADDRESS: token_manager_erc20_implementation.generate_contract(),

        TOKEN_MANAGER_ERC721_ADDRESS: token_manager_erc721.generate_contract(),
        TOKEN_MANAGER_ERC721_IMPLEMENTATION_ADDRESS: token_manager_erc721_implementation.generate_contract(),

        TOKEN_MANAGER_ERC1155_ADDRESS: token_manager_erc1155.generate_contract(),
        TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS: token_manager_erc1155_implementation.generate_contract(),

        TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS: token_manager_erc721_with_metadata.generate_contract(),
        TOKEN_MANAGER_ERC721_WITH_METADATA_IMPLEMENTATION_ADDRESS: token_manager_erc721_with_metadata_implementation.generate_contract(),

        ETH_ERC20_ADDRESS: eth_erc20.generate_contract(),
        ETH_ERC20_IMPLEMENTATION_ADDRESS: eth_erc20_implementation.generate_contract()
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
            ContractGenerator(ProxyAdminGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'message_proxy_chain',
            MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
            ContractGenerator(MessageProxyForSchainGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'key_storage',
            KEY_STORAGE_ADDRESS,
            ContractGenerator(KeyStorageGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'community_locker',
            COMMUNITY_LOCKER_ADDRESS,
            ContractGenerator(CommunityLockerGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'token_manager_linker',
            TOKEN_MANAGER_LINKER_ADDRESS,
            ContractGenerator(TokenManagerLinkerGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'token_manager_eth',
            TOKEN_MANAGER_ETH_ADDRESS,
            ContractGenerator(TokenManagerEthGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'token_manager_erc20',
            TOKEN_MANAGER_ERC20_ADDRESS,
            ContractGenerator(TokenManagerErc20Generator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'token_manager_erc721',
            TOKEN_MANAGER_ERC721_ADDRESS,
            ContractGenerator(TokenManagerErc721Generator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'token_manager_erc1155',
            TOKEN_MANAGER_ERC1155_ADDRESS,
            ContractGenerator(TokenManagerErc1155Generator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'token_manager_erc721_with_metadata',
            TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS,
            ContractGenerator(TokenManagerErc721WithMetadataGenerator.ARTIFACT_FILENAME).abi),
        **generate_abi_key(
            'eth_erc20',
            ETH_ERC20_ADDRESS,
            ContractGenerator(EthErc20Generator.ARTIFACT_FILENAME).abi),
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
