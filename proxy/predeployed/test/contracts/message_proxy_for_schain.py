from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, KEY_STORAGE_ADDRESS
from ima_predeployed.contracts.message_proxy_for_schain import MessageProxyForSchainGenerator
from tools import load_abi, w3


def check_message_proxy_for_schain(owner_address):
    message_proxy_for_schain = w3.eth.contract(address=MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
                                               abi=load_abi(MessageProxyForSchainGenerator.ARTIFACT_FILENAME))
    assert message_proxy_for_schain.functions.getRoleMember(
        MessageProxyForSchainGenerator.DEFAULT_ADMIN_ROLE, 0).call() == owner_address
    assert message_proxy_for_schain.functions.hasRole(
        MessageProxyForSchainGenerator.DEFAULT_ADMIN_ROLE, owner_address).call()
    assert message_proxy_for_schain.functions.keyStorage().call() == KEY_STORAGE_ADDRESS
    assert message_proxy_for_schain.functions.getIncomingMessagesCounter('Mainnet').call() == 0
    assert message_proxy_for_schain.functions.getOutgoingMessagesCounter('Mainnet').call() == 0
    assert message_proxy_for_schain.functions.isConnectedChain('Mainnet').call()
