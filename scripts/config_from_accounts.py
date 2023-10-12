#!/usr/bin/python3

#   SPDX-License-Identifier: AGPL-3.0-only

#   -*- coding: utf-8 -*-
#
#   This file is part of SKALE IMA.
#
#   Copyright (C) 2019-Present SKALE Labs
#
#   SKALE IMA is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   SKALE IMA is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.

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
        config = {'PRIVATE_KEY_FOR_ETHEREUM': accounts['private_keys'][addresses[0]],
                  'PRIVATE_KEY_FOR_SCHAIN': accounts['private_keys'][addresses[1]]}
        with open(config_filename, 'w') as config_file:
            json.dump(config, config_file)


if __name__ == '__main__':
    main()