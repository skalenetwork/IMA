from contracts.community_locker import check_community_locker
from contracts.eth_erc20 import check_eth_erc20
from contracts.key_storage import check_key_storage
from contracts.message_proxy_for_schain import check_message_proxy_for_schain
from contracts.token_manager_erc20 import check_token_manager_erc20
from contracts.token_manager_erc721 import check_token_manager_erc721
from contracts.token_manager_erc1155 import check_token_manager_erc1155
from contracts.token_manager_erc721_with_metadata import check_token_manager_erc721_with_metadata
from contracts.token_manager_eth import check_token_manager_eth
from contracts.token_manager_linker import check_token_manager_linker
from test_generator import check_meta_generator
import json

with open('config.json') as config_file:
    config = json.load(config_file)
    owner_address = config['schain_owner']
    schain_name = config['schain_name']
    eth_deposit_box = config['eth_deposit_box']
    erc20_deposit_box = config['erc20_deposit_box']
    erc721_deposit_box = config['erc721_deposit_box']
    erc1155_deposit_box = config['erc1155_deposit_box']
    linker_address = config['linker']
    community_pool = config['community_pool']
    erc721_with_metadata_deposit_box = config['erc721_with_metadata_deposit_box']


def main():
    check_message_proxy_for_schain(owner_address, schain_name)
    check_key_storage(owner_address)
    check_community_locker(owner_address, schain_name, community_pool)
    check_token_manager_linker(owner_address, linker_address)
    check_token_manager_eth(owner_address, eth_deposit_box, schain_name)
    check_token_manager_erc20(owner_address, erc20_deposit_box, schain_name)
    check_token_manager_erc721(owner_address, erc721_deposit_box, schain_name)
    check_token_manager_erc1155(owner_address, erc1155_deposit_box, schain_name)
    check_token_manager_erc721_with_metadata(owner_address, erc721_with_metadata_deposit_box, schain_name)
    check_eth_erc20(owner_address)
    check_meta_generator()

    print('All tests pass')


if __name__ == '__main__':
    main()
