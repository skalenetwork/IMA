from ima_predeployed.addresses import TOKEN_MANAGER_LINKER_ADDRESS, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_ETH_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS
from ima_predeployed.contracts.token_manager_linker import TokenManagerLinkerGenerator
from tools import w3, load_abi


def check_token_manager_linker(deployer_address, linker_address):
    token_manager_linker = w3.eth.contract(
        address=TOKEN_MANAGER_LINKER_ADDRESS, abi=load_abi(TokenManagerLinkerGenerator.ARTIFACT_FILENAME))
    assert token_manager_linker.functions.getRoleMember(
        TokenManagerLinkerGenerator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address
    assert token_manager_linker.functions.hasRole(
        TokenManagerLinkerGenerator.DEFAULT_ADMIN_ROLE, deployer_address).call()
    assert token_manager_linker.functions.getRoleMember(
        TokenManagerLinkerGenerator.REGISTRAR_ROLE, 0).call() == deployer_address
    assert token_manager_linker.functions.hasRole(
        TokenManagerLinkerGenerator.REGISTRAR_ROLE, deployer_address).call()
    assert token_manager_linker.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS
    assert token_manager_linker.functions.linkerAddress().call() == token_manager_linker
    assert token_manager_linker.functions.tokenManagers(0).call() == TOKEN_MANAGER_ETH_ADDRESS
    assert token_manager_linker.functions.tokenManagers(1).call() == TOKEN_MANAGER_ERC20_ADDRESS
    assert token_manager_linker.functions.tokenManagers(2).call() == TOKEN_MANAGER_ERC721_ADDRESS
