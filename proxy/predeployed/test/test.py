from contracts.admin_upgradeability_proxy import check_admin_upgradeability_proxy
from contracts.community_locker import check_community_locker
from contracts.key_storage import check_key_storage
from contracts.message_proxy_for_schain import check_message_proxy_for_schain
from contracts.proxy_admin import check_proxy_admin
from contracts.token_manager_erc20 import check_token_manager_erc20
from contracts.token_manager_eth import check_token_manager_eth
from contracts.token_manager_linker import check_token_manager_linker
import json


with open('config.json') as config_file:
    config = json.load(config_file)
    owner_address = config['schain_owner']
    schain_name = config['schain_name']
    eth_deposit_box = config['eth_deposit_box']


def main():
    check_proxy_admin(owner_address)
    check_admin_upgradeability_proxy()
    check_message_proxy_for_schain(owner_address)
    check_key_storage(owner_address)
    check_community_locker(owner_address, schain_name)
    check_token_manager_linker(owner_address)
    check_token_manager_eth(owner_address, eth_deposit_box, schain_name)
    check_token_manager_erc20(owner_address, eth_deposit_box, schain_name)

    print('All tests pass')


if __name__ == '__main__':
    main()
