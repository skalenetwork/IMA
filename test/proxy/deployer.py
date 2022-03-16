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

from tools.utils import execute
from os import chdir

class Deployer:
    def __init__(self, config):
        self.config = config

    def deploy(self):
        chdir(self.config.proxy_root)
        self._prepare_env_file()
        execute('yarn deploy-skale-manager-components')
        execute('yarn deploy-to-both-chains')

    def deploy_mainnet(self):
        chdir(self.config.proxy_root)
        self._prepare_env_file()
        execute('yarn deploy-skale-manager-components')
        execute('yarn deploy-to-mainnet')

    def deploy_schain(self, schain_name):
        chdir(self.config.proxy_root)
        self._prepare_env_file(schain_name)
        execute('yarn deploy-to-schain')

    def deploy_second_schain(self):
        self.deploy()
        self.deploy_schain(self.config.schain_name_2)


    # private

    def _prepare_env_file(self, schain_name=''):
        if schain_name == '' : schain_name = self.config.schain_name
        env_file = [f'NETWORK_FOR_ETHEREUM="{self.config.network_for_mainnet}"',
                    f'NETWORK_FOR_SCHAIN="{self.config.network_for_schain}"',
                    f'PRIVATE_KEY_FOR_ETHEREUM="{self.config.mainnet_key}"',
                    f'URL_W3_ETHEREUM="{self.config.mainnet_rpc_url}"',
                    f'PRIVATE_KEY_FOR_SCHAIN="{self.config.schain_key}"',
                    f'URL_W3_S_CHAIN="{self.config.schain_rpc_url}"',
                    f'CHAIN_NAME_SCHAIN="{schain_name}"',
                    'NO_SIGNATURES=true']

        with open('.env', 'w') as dot_env:
            dot_env.write('\n'.join(env_file))

