from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS, COMMUNITY_LOCKER_ADDRESS, TOKEN_MANAGER_ERC1155_ADDRESS
from ima_predeployed.contracts.token_manager_erc1155 import TokenManagerErc1155Generator
from tools import w3, load_abi


def check_token_manager_erc1155(deployer_address, deposit_box_address, schain_name):
    token_manager_erc1155 = w3.eth.contract(
        address=TOKEN_MANAGER_ERC1155_ADDRESS, abi=load_abi(TokenManagerErc1155Generator.ARTIFACT_FILENAME))
    if not token_manager_erc1155.functions.getRoleMember(
        TokenManagerErc1155Generator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc1155.functions.hasRole(
        TokenManagerErc1155Generator.DEFAULT_ADMIN_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc1155.functions.getRoleMember(
        TokenManagerErc1155Generator.AUTOMATIC_DEPLOY_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc1155.functions.hasRole(
        TokenManagerErc1155Generator.AUTOMATIC_DEPLOY_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc1155.functions.getRoleMember(
        TokenManagerErc1155Generator.TOKEN_REGISTRAR_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc1155.functions.hasRole(
        TokenManagerErc1155Generator.TOKEN_REGISTRAR_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc1155.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: raise AssertionError
    if not token_manager_erc1155.functions.tokenManagerLinker().call() == TOKEN_MANAGER_LINKER_ADDRESS: raise AssertionError
    if not token_manager_erc1155.functions.communityLocker().call() == COMMUNITY_LOCKER_ADDRESS: raise AssertionError
    if not token_manager_erc1155.functions.schainHash().call() == w3.solidity_keccak(['string'], [schain_name]): raise AssertionError
    if not token_manager_erc1155.functions.depositBox().call() == deposit_box_address: raise AssertionError
    if token_manager_erc1155.functions.automaticDeploy().call(): raise AssertionError
