import json
import os
import time

HERE = os.path.dirname(os.path.realpath(__file__))
CREDS_DIR = os.path.join(HERE, 'creds')

cred_files = os.listdir(CREDS_DIR)

DEFAULT_USER = 'root'
NODE_DATA_PATH = '/skale_node_data'
SCHAINS_DIR_NAME = 'schains'
SCHAINS_DIR_PATH = os.path.join(NODE_DATA_PATH, SCHAINS_DIR_NAME)


def get_schain_dir_path(schain_name):
    return os.path.join(SCHAINS_DIR_PATH, schain_name)


for file in cred_files:

    filepath = os.path.join(CREDS_DIR, file)
    with open(filepath) as f:
        data = json.load(f)

    ip1 = data['schain_info']['schain_nodes'][0]['ip']
    ip2 = data['schain_info']['schain_nodes'][1]['ip']

    rpc_port = data['schain_info']['schain_nodes'][0]['rpcPort']
    rpc_endpoint = f'http://{ip1}:{rpc_port}'

    schain_name = data['schain_info']['schain_struct']['name']
    path_on_node = get_schain_dir_path(schain_name)

    deploy_cmd = f'cd proxy && SCHAIN_RPC_IP={ip1} SCHAIN_RPC_PORT={rpc_port} SCHAIN_NAME={schain_name} NETWORK=schain bash deploy.sh'

    print('========')
    print(deploy_cmd)

    os.system(deploy_cmd)

    abi_filename = f'schain_{schain_name}_proxy.json'
    path_here = os.path.join(HERE, 'proxy', 'data', abi_filename)

    for node in data['schain_info']['schain_nodes']:
        cmd = f'scp -o StrictHostKeyChecking=no {path_here} {DEFAULT_USER}@{node["ip"]}:{path_on_node}/proxy.json'

        print(cmd)
        print(node["ip"])

        os.system(cmd)
        time.sleep(20)


    #print(ip1)
    #print(schain_name)
    #print(ip2)
    #print(rpc_endpoint)




#cred_files = fnmatch.filter(os.listdir(schain_data_dir), SCHAIN_LOG_PATTERN)