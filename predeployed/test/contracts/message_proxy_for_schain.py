from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, KEY_STORAGE_ADDRESS, \
    TOKEN_MANAGER_ETH_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS, COMMUNITY_LOCKER_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS, \
    TOKEN_MANAGER_ERC1155_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS
from ima_predeployed.contracts.message_proxy_for_schain import MessageProxyForSchainGenerator
from tools import load_abi, w3
from pkg_resources import get_distribution


def check_message_proxy_for_schain(owner_address, schain_name):
    message_proxy_for_schain = w3.eth.contract(address=MESSAGE_PROXY_FOR_SCHAIN_ADDRESS,
                                               abi=load_abi(MessageProxyForSchainGenerator.ARTIFACT_FILENAME))
    if not message_proxy_for_schain.functions.getRoleMember(
            MessageProxyForSchainGenerator.DEFAULT_ADMIN_ROLE, 0).call() == owner_address:
        raise AssertionError
    if not message_proxy_for_schain.functions.getRoleMember(
            MessageProxyForSchainGenerator.CHAIN_CONNECTOR_ROLE, 0).call() == TOKEN_MANAGER_LINKER_ADDRESS:
        raise AssertionError
    if not message_proxy_for_schain.functions.hasRole(
            MessageProxyForSchainGenerator.DEFAULT_ADMIN_ROLE, owner_address).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.hasRole(
            MessageProxyForSchainGenerator.CHAIN_CONNECTOR_ROLE, TOKEN_MANAGER_LINKER_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.keyStorage().call() == KEY_STORAGE_ADDRESS:
        raise AssertionError
    if not message_proxy_for_schain.functions.schainHash().call() == w3.solidity_keccak(['string'], [schain_name]):
        raise AssertionError
    if not message_proxy_for_schain.functions.getIncomingMessagesCounter('Mainnet').call() == 0:
        raise AssertionError
    if not message_proxy_for_schain.functions.getOutgoingMessagesCounter('Mainnet').call() == 0:
        raise AssertionError
    if not message_proxy_for_schain.functions.isConnectedChain('Mainnet').call():
        raise AssertionError
    if not message_proxy_for_schain.functions.gasLimit().call() == MessageProxyForSchainGenerator.GAS_LIMIT:
        raise AssertionError
    if not message_proxy_for_schain.functions.getContractRegisteredLength(MessageProxyForSchainGenerator.ANY_SCHAIN).call() == 6:
        raise AssertionError
    if not message_proxy_for_schain.functions.getContractRegisteredRange(MessageProxyForSchainGenerator.ANY_SCHAIN, 0, 6).call() == [
        TOKEN_MANAGER_ETH_ADDRESS,
        TOKEN_MANAGER_ERC20_ADDRESS,
        TOKEN_MANAGER_ERC721_ADDRESS,
        TOKEN_MANAGER_ERC1155_ADDRESS,
        TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS,
        COMMUNITY_LOCKER_ADDRESS
    ]:
        raise AssertionError
    if not message_proxy_for_schain.functions.isContractRegistered(MessageProxyForSchainGenerator.ANY_SCHAIN,
                                                                TOKEN_MANAGER_ETH_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.isContractRegistered(MessageProxyForSchainGenerator.ANY_SCHAIN,
                                                                TOKEN_MANAGER_ERC20_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.isContractRegistered(MessageProxyForSchainGenerator.ANY_SCHAIN,
                                                                TOKEN_MANAGER_ERC721_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.isContractRegistered(MessageProxyForSchainGenerator.ANY_SCHAIN,
                                                                TOKEN_MANAGER_ERC1155_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.isContractRegistered(MessageProxyForSchainGenerator.ANY_SCHAIN,
                                                                TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.isContractRegistered(MessageProxyForSchainGenerator.ANY_SCHAIN,
                                                                COMMUNITY_LOCKER_ADDRESS).call():
        raise AssertionError
    if not message_proxy_for_schain.functions.version().call() == get_distribution('ima_predeployed').version:
        raise AssertionError
