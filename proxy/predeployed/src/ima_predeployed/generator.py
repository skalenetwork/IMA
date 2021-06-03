import json
import os

from ima_predeployed.contracts.eth_erc20 import EthErc20Generator
from ima_predeployed.contracts.token_manager_erc20 import TokenManagerErc20Generator
from ima_predeployed.contracts.token_manager_erc721 import TokenManagerErc721Generator
from ima_predeployed.contracts.token_manager_erc1155 import TokenManagerErc1155Generator
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
    ETH_ERC20_ADDRESS


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
        CommunityLockerGenerator(owner_address, schain_name, contracts_on_mainnet['community_pool'])
    )

    token_manager_linker_implementation = ContractGenerator(TokenManagerLinkerGenerator.ARTIFACT_FILENAME)
    token_manager_linker = UpgradeableContractGenerator(
        TOKEN_MANAGER_LINKER_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerLinkerGenerator(owner_address, contracts_on_mainnet['linker'])
    )

    token_manager_eth_implementation = ContractGenerator(TokenManagerEthGenerator.ARTIFACT_FILENAME)
    token_manager_eth = UpgradeableContractGenerator(
        TOKEN_MANAGER_ETH_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerEthGenerator(owner_address, contracts_on_mainnet['eth_deposit_box'], schain_name)
    )

    token_manager_erc20_implementation = ContractGenerator(TokenManagerErc20Generator.ARTIFACT_FILENAME)
    token_manager_erc20 = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC20_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc20Generator(owner_address, contracts_on_mainnet['erc20_deposit_box'], schain_name)
    )

    token_manager_erc721_implementation = ContractGenerator(TokenManagerErc721Generator.ARTIFACT_FILENAME)
    token_manager_erc721 = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC721_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc721Generator(owner_address, contracts_on_mainnet['erc721_deposit_box'], schain_name)
    )

    token_manager_erc1155_implementation = ContractGenerator(TokenManagerErc1155Generator.ARTIFACT_FILENAME)
    token_manager_erc1155 = UpgradeableContractGenerator(
        TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS,
        PROXY_ADMIN_ADDRESS,
        TokenManagerErc1155Generator(owner_address, contracts_on_mainnet['erc1155_deposit_box'], schain_name)
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

        ETH_ERC20_ADDRESS: eth_erc20.generate_contract(),
        ETH_ERC20_IMPLEMENTATION_ADDRESS: eth_erc20_implementation.generate_contract()
    }


def main() -> None:
    contracts_dir = os.path.join(os.path.dirname(__file__), 'artifacts')
    proxy_admin_path = os.path.join(contracts_dir, 'ProxyAdmin.json')    
    with open(proxy_admin_path, encoding='utf-8') as fp:
        proxy_admin = json.load(fp)
        print(proxy_admin['contractName'])


if __name__ == '__main__':
    main()
