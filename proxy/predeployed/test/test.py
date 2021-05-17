from ima_predeployed.addresses import \
    PROXY_ADMIN_ADDRESS,\
    MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,\
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS
from ima_predeployed.contracts.admin_upgradeability_proxy import AdminUpgradeabilityProxyGenerator
from ima_predeployed.contracts.message_proxy_for_schain import MessageProxyForSchainGenerator
import json
import os
from web3 import Web3

w3 = Web3()


with open('config.json') as config_file:
    config = json.load(config_file)
    owner_address = config['schain_owner']


def load_abi(filename: str) -> list:
    artifacts_dir = os.path.join(os.path.dirname(__file__), '../src/ima_predeployed/artifacts')
    artifact_path = os.path.join(artifacts_dir, filename)
    with open(artifact_path) as file:
        return json.load(file)['abi']


def check_proxy_admin():
    proxy_admin = w3.eth.contract(address=PROXY_ADMIN_ADDRESS, abi=load_abi('ProxyAdmin.json'))
    assert proxy_admin.functions.owner().call() == owner_address


def check_admin_upgradeability_proxy():
    proxy_admin = w3.eth.contract(address=PROXY_ADMIN_ADDRESS, abi=load_abi('ProxyAdmin.json'))
    assert proxy_admin.functions.getProxyAdmin(MESSAGE_PROXY_FOR_SCHAIN_ADDRESS).call() == PROXY_ADMIN_ADDRESS
    assert proxy_admin.functions.getProxyImplementation(
        MESSAGE_PROXY_FOR_SCHAIN_ADDRESS).call() == MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS


def check_message_proxy_for_schain():
    message_proxy_for_schain = w3.eth.contract(address=MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
                                               abi=load_abi(MessageProxyForSchainGenerator.ARTIFACT_FILENAME))
    assert message_proxy_for_schain.functions.getRoleMember(
        MessageProxyForSchainGenerator.DEFAULT_ADMIN_ROLE.to_bytes(32, 'big'), 0) == owner_address
    assert message_proxy_for_schain.functions.hasRole(MessageProxyForSchainGenerator.DEFAULT_ADMIN_ROLE, owner_address)


def main():
    check_proxy_admin()
    check_admin_upgradeability_proxy()
    check_message_proxy_for_schain()


if __name__ == '__main__':
    main()
