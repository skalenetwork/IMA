from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS, COMMUNITY_LOCKER_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS
from ima_predeployed.contracts.token_manager_erc721 import TokenManagerErc721Generator
from tools import w3, load_abi


def check_token_manager_erc721(deployer_address, deposit_box_address, schain_name):
    token_manager_erc721 = w3.eth.contract(
        address=TOKEN_MANAGER_ERC721_ADDRESS, abi=load_abi(TokenManagerErc721Generator.ARTIFACT_FILENAME))
    if not token_manager_erc721.functions.getRoleMember(
        TokenManagerErc721Generator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc721.functions.hasRole(
        TokenManagerErc721Generator.DEFAULT_ADMIN_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc721.functions.getRoleMember(
        TokenManagerErc721Generator.AUTOMATIC_DEPLOY_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc721.functions.hasRole(
        TokenManagerErc721Generator.AUTOMATIC_DEPLOY_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc721.functions.getRoleMember(
        TokenManagerErc721Generator.TOKEN_REGISTRAR_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc721.functions.hasRole(
        TokenManagerErc721Generator.TOKEN_REGISTRAR_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc721.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: raise AssertionError
    if not token_manager_erc721.functions.tokenManagerLinker().call() == TOKEN_MANAGER_LINKER_ADDRESS: raise AssertionError
    if not token_manager_erc721.functions.communityLocker().call() == COMMUNITY_LOCKER_ADDRESS: raise AssertionError
    if not token_manager_erc721.functions.schainHash().call() == w3.solidity_keccak(['string'], [schain_name]): raise AssertionError
    if not token_manager_erc721.functions.depositBox().call() == deposit_box_address: raise AssertionError
    if token_manager_erc721.functions.automaticDeploy().call(): raise AssertionError
