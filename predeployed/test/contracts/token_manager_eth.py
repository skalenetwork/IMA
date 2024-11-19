from ima_predeployed.addresses import TOKEN_MANAGER_ETH_ADDRESS, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS, COMMUNITY_LOCKER_ADDRESS, ETH_ERC20_ADDRESS
from ima_predeployed.contracts.token_manager_eth import TokenManagerEthGenerator
from tools import w3, load_abi


def check_token_manager_eth(deployer_address, deposit_box_address, schain_name):
    token_manager_eth = w3.eth.contract(
        address=TOKEN_MANAGER_ETH_ADDRESS, abi=load_abi(TokenManagerEthGenerator.ARTIFACT_FILENAME))
    if not token_manager_eth.functions.getRoleMember(
        TokenManagerEthGenerator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_eth.functions.hasRole(
        TokenManagerEthGenerator.DEFAULT_ADMIN_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_eth.functions.getRoleMember(
        TokenManagerEthGenerator.AUTOMATIC_DEPLOY_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_eth.functions.hasRole(
        TokenManagerEthGenerator.AUTOMATIC_DEPLOY_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_eth.functions.getRoleMember(
        TokenManagerEthGenerator.TOKEN_REGISTRAR_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_eth.functions.hasRole(
        TokenManagerEthGenerator.TOKEN_REGISTRAR_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_eth.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: raise AssertionError
    if not token_manager_eth.functions.tokenManagerLinker().call() == TOKEN_MANAGER_LINKER_ADDRESS: raise AssertionError
    if not token_manager_eth.functions.communityLocker().call() == COMMUNITY_LOCKER_ADDRESS: raise AssertionError
    if not token_manager_eth.functions.schainHash().call() == w3.solidity_keccak(['string'], [schain_name]): raise AssertionError
    if not token_manager_eth.functions.depositBox().call() == deposit_box_address: raise AssertionError
    if token_manager_eth.functions.automaticDeploy().call(): raise AssertionError
    if not token_manager_eth.functions.ethErc20().call() == ETH_ERC20_ADDRESS: raise AssertionError
