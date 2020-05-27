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

class Config:
    src_root = '.'
    agent_root = 'agent'
    skale_ima_root = 'npms/skale-ima'
    proxy_root = 'proxy'
    test_root = 'test'
    test_working_dir = 'working'
    test_resource_dir = 'resources'
    network_for_mainnet = 'mainnet'
    network_for_schain = 'schain'
    mainnet_key=''
    mainnet_rpc_url='http://localhost:8545'
    schain_key = ''
    schain_rpc_url = 'http://localhost:8545'
    schain_name = 'd2'
    abi_mainnet = 'data/proxyMainnet.json'
    abi_schain = 'data/proxySchain_'
    user_key = ''

    def __init__(self, src_root, config_json):
        self.src_root = src_root
        self.proxy_root = src_root + '/' + self.proxy_root
        self.agent_root = src_root + '/' + self.agent_root
        self.skale_ima_root = src_root + '/' + self.skale_ima_root
        self.test_root = src_root + '/' + self.test_root
        self.test_working_dir = self.test_root + '/' + self.test_working_dir
        self.test_resource_dir = self.test_root + '/' + self.test_resource_dir

        if 'NETWORK_FOR_MAINNET' in config_json:
            self.network_for_mainnet = config_json['NETWORK_FOR_MAINNET']
        if 'NETWORK_FOR_SCHAIN' in config_json:
            self.network_for_schain = config_json['NETWORK_FOR_SCHAIN']
        self.mainnet_key = config_json['ETH_PRIVATE_KEY_FOR_MAINNET']
        if 'MAINNET_RPC_URL' in config_json:
            self.mainnet_rpc_url = config_json['MAINNET_RPC_URL']
        self.schain_key = config_json['ETH_PRIVATE_KEY_FOR_SCHAIN']
        if 'SCHAIN_RPC_URL' in config_json:
            self.schain_rpc_url = config_json['SCHAIN_RPC_URL']
        if 'SCHAIN_NAME' in config_json:
            self.schain_name = config_json['SCHAIN_NAME']
        if 'user_key' in config_json:
            self.user_key = config_json['user_key']

        self.abi_mainnet = self.proxy_root + '/' + self.abi_mainnet
        self.abi_schain = self.proxy_root + '/' + self.abi_schain + self.schain_name + '.json'


