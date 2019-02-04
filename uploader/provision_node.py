import os
import json

DEFAULT_USER = 'root'
NODE_DATA_PATH = '/skale_node_data'
SCHAINS_DIR_NAME = 'schains'
SCHAINS_DIR_PATH = os.path.join(NODE_DATA_PATH, SCHAINS_DIR_NAME)

def get_schain_dir_path(schain_name):
    return os.path.join(SCHAINS_DIR_PATH, schain_name)


with open('config.json') as f:
    config = json.load(f)

path_on_node = get_schain_dir_path(config['sChainName'])

for node_ip in config['nodes']:
    cmd = f'scp -o StrictHostKeyChecking=no ../proxy/schain_proxy.json {DEFAULT_USER}@{node_ip}:{path_on_node}/proxy.json'

    print(node_ip)
    print(cmd)

    os.system(cmd)

