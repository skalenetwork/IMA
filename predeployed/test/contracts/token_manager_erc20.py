from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS, COMMUNITY_LOCKER_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS
from ima_predeployed.contracts.token_manager_erc20 import TokenManagerErc20Generator
from tools import w3, load_abi


def check_token_manager_erc20(deployer_address, deposit_box_address, schain_name):
    token_manager_erc20 = w3.eth.contract(
        address=TOKEN_MANAGER_ERC20_ADDRESS, abi=load_abi(TokenManagerErc20Generator.ARTIFACT_FILENAME))
    if not token_manager_erc20.functions.getRoleMember(
        TokenManagerErc20Generator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc20.functions.hasRole(
        TokenManagerErc20Generator.DEFAULT_ADMIN_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc20.functions.getRoleMember(
        TokenManagerErc20Generator.AUTOMATIC_DEPLOY_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc20.functions.hasRole(
        TokenManagerErc20Generator.AUTOMATIC_DEPLOY_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc20.functions.getRoleMember(
        TokenManagerErc20Generator.TOKEN_REGISTRAR_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc20.functions.hasRole(
        TokenManagerErc20Generator.TOKEN_REGISTRAR_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc20.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: raise AssertionError
    if not token_manager_erc20.functions.tokenManagerLinker().call() == TOKEN_MANAGER_LINKER_ADDRESS: raise AssertionError
    if not token_manager_erc20.functions.communityLocker().call() == COMMUNITY_LOCKER_ADDRESS: raise AssertionError
    if not token_manager_erc20.functions.schainHash().call() == w3.solidity_keccak(['string'], [schain_name]): raise AssertionError
    if not token_manager_erc20.functions.depositBox().call() == deposit_box_address: raise AssertionError
    if token_manager_erc20.functions.automaticDeploy().call(): raise AssertionError
