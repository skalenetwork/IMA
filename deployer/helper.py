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

import os
import json
import random

from config import SCHAINS_DIR_PATH, CREDS_DIR, PROJECT_DIR

def get_schain_dir_path(schain_name):
    return os.path.join(SCHAINS_DIR_PATH, schain_name)


def get_schain_creds_file(filename):
    filepath = os.path.join(CREDS_DIR, filename)
    with open(filepath) as f:
        return json.load(f)


def get_random_endpoint(schain_nodes):
    node = random.choice(schain_nodes)
    return get_node_endpoint(node)


def get_node_endpoint(node):
    return node['ip'], node['rpcPort']


def get_abi_filename(schain_name):
    return f'schain_{schain_name}_proxy.json'


def get_abi_project_path(abi_filename):
    return os.path.join(PROJECT_DIR, 'proxy', 'data', abi_filename)
