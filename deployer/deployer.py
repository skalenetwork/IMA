import os
import time

from helper import get_random_endpoint, get_schain_creds_file, get_abi_filename, get_abi_project_path, \
    get_schain_dir_path
from config import LONG_LINE, DEFAULT_USER, CREDS_FILES, PROJECT_PROXY_PATH


def deploy_IMA_on_schain(schain_creds):
    schain_nodes = schain_creds['schain_info']['schain_nodes']
    schain_name = schain_creds['schain_info']['schain_struct']['name']

    ip, port = get_random_endpoint(schain_nodes)

    deploy_IMA_contracts_on_schain(ip, port, schain_name)
    copy_abi_on_nodes(schain_nodes, schain_name)


def deploy_IMA_contracts_on_schain(rpc_ip, rpc_port, schain_name):
    deploy_cmd = f'cd {PROJECT_PROXY_PATH} && SCHAIN_RPC_IP={rpc_ip} SCHAIN_RPC_PORT={rpc_port} SCHAIN_NAME={schain_name} NETWORK=schain bash deploy.sh'
    print(LONG_LINE, '\n', deploy_cmd)
    os.system(deploy_cmd)


def copy_abi_on_nodes(schain_nodes, schain_name):
    abi_filename = get_abi_filename(schain_name)
    abi_project_path = get_abi_project_path(abi_filename)

    abi_path_on_node = get_schain_dir_path(schain_name)

    for node in schain_nodes:
        node_ip = node["ip"]
        node_user = DEFAULT_USER

        cmd = f'scp -o StrictHostKeyChecking=no {abi_project_path} {node_user}@{node_ip}:{abi_path_on_node}/proxy.json'
        print(f'Uploading to {node_ip}...', '\n', cmd)
        os.system(cmd)
        time.sleep(20)


if __name__ == '__main__':
    cred_files = CREDS_FILES
    for file in cred_files:
        schain_creds = get_schain_creds_file(file)
        deploy_IMA_on_schain(schain_creds)
