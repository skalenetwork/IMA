#!/usr/bin/python3

from sys import argv
import json

def main():
    if len(argv) < 2:
        print('Usage: config_from_accounts.py {file with accounts} {target config file}')
        exit(1)

    accounts_filename, config_filename = argv[1], argv[2]
    with open(accounts_filename) as accounts_file:
        accounts = json.load(accounts_file)
        addresses = list(accounts['private_keys'].keys())
        config = {'ETH_PRIVATE_KEY_FOR_MAINNET': accounts['private_keys'][addresses[0]],
                  'ETH_PRIVATE_KEY_FOR_SCHAIN': accounts['private_keys'][addresses[1]]}
        with open(config_filename, 'w') as config_file:
            json.dump(config, config_file)


if __name__ == '__main__':
    main()