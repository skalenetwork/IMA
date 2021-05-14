from web3.auto import w3
from ima_predeployed.addresses import PROXY_ADMIN_ADDRESS, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS
from ima_predeployed.contracts.admin_upgradeability_proxy import AdminUpgradeabilityProxyGenerator
import json
import os

with open('config.json') as config_file:
    config = json.load(config_file)


def load_abi(filename: str) -> list:
    artifacts_dir = os.path.join(os.path.dirname(__file__), '../src/ima_predeployed/artifacts')
    artifact_path = os.path.join(artifacts_dir, filename)
    with open(artifact_path) as file:
        return json.load(file)['abi']


def check_proxy_admin():
    proxy_admin = w3.eth.contract(address=PROXY_ADMIN_ADDRESS, abi=load_abi('ProxyAdmin.json'))
    assert proxy_admin.functions.owner().call() == config['schain_owner']


def check_admin_upgradeability_proxy():
    proxy_admin = w3.eth.contract(address=PROXY_ADMIN_ADDRESS, abi=load_abi('ProxyAdmin.json'))
    assert proxy_admin.functions.getProxyAdmin(MESSAGE_PROXY_FOR_SCHAIN_ADDRESS).call() == PROXY_ADMIN_ADDRESS
    assert proxy_admin.functions.getProxyImplementation(MESSAGE_PROXY_FOR_SCHAIN_ADDRESS).call() == PROXY_ADMIN_ADDRESS


def main():
    check_proxy_admin()
    check_admin_upgradeability_proxy()


if __name__ == '__main__':
    main()
