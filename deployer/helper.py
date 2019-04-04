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
