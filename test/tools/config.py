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
    schain_name_2 = 'd3'
    abi_mainnet = 'data/proxyMainnet.json'
    abi_schain = 'data/proxySchain_'
    abi_schain_2 = 'data/proxySchain_'
    user_key = ''

    def __init__(self, src_root, config_json):
        self.src_root = src_root
        self.proxy_root = src_root + '/' + self.proxy_root
        self.agent_root = src_root + '/' + self.agent_root
        self.skale_ima_root = src_root + '/' + self.skale_ima_root
        self.test_root = src_root + '/' + self.test_root
        self.test_working_dir = self.test_root + '/' + self.test_working_dir
        self.test_resource_dir = self.test_root + '/' + self.test_resource_dir

        if 'NETWORK_FOR_ETHEREUM' in config_json:
            self.network_for_mainnet = config_json['NETWORK_FOR_ETHEREUM']
        if 'NETWORK_FOR_SCHAIN' in config_json:
            self.network_for_schain = config_json['NETWORK_FOR_SCHAIN']
        self.mainnet_key = config_json['PRIVATE_KEY_FOR_ETHEREUM']
        if 'URL_W3_ETHEREUM' in config_json:
            self.mainnet_rpc_url = config_json['URL_W3_ETHEREUM']
        self.schain_key = config_json['PRIVATE_KEY_FOR_SCHAIN']
        if 'URL_W3_S_CHAIN' in config_json:
            self.schain_rpc_url = config_json['URL_W3_S_CHAIN']
        if 'CHAIN_NAME_SCHAIN' in config_json:
            self.schain_name = config_json['CHAIN_NAME_SCHAIN']
        if 'user_key' in config_json:
            self.user_key = config_json['user_key']

        self.abi_mainnet = self.proxy_root + '/' + self.abi_mainnet
        self.abi_schain = self.proxy_root + '/' + self.abi_schain + self.schain_name + '.json'
        self.abi_schain_2 = self.proxy_root + '/' + self.abi_schain_2 + self.schain_name_2 + '.json'


