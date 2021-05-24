from contracts.admin_upgradeability_proxy import check_admin_upgradeability_proxy
from contracts.key_storage import check_key_storage
from contracts.message_proxy_for_schain import check_message_proxy_for_schain
from contracts.proxy_admin import check_proxy_admin
import json

with open('config.json') as config_file:
    config = json.load(config_file)
    owner_address = config['schain_owner']


def main():
    check_proxy_admin(owner_address)
    check_admin_upgradeability_proxy()
    check_message_proxy_for_schain(owner_address)
    check_key_storage(owner_address)

    print('All tests pass')


if __name__ == '__main__':
    main()
