from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS, COMMUNITY_LOCKER_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS
from ima_predeployed.contracts.token_manager_erc721_with_metadata import TokenManagerErc721WithMetadataGenerator
from tools import w3, load_abi


def check_token_manager_erc721_with_metadata(deployer_address, deposit_box_address, schain_name):
    token_manager_erc721_with_metadata = w3.eth.contract(
        address=TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS, abi=load_abi(TokenManagerErc721WithMetadataGenerator.ARTIFACT_FILENAME))
    if not token_manager_erc721_with_metadata.functions.getRoleMember(
        TokenManagerErc721WithMetadataGenerator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc721_with_metadata.functions.hasRole(
        TokenManagerErc721WithMetadataGenerator.DEFAULT_ADMIN_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc721_with_metadata.functions.getRoleMember(
        TokenManagerErc721WithMetadataGenerator.AUTOMATIC_DEPLOY_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc721_with_metadata.functions.hasRole(
        TokenManagerErc721WithMetadataGenerator.AUTOMATIC_DEPLOY_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc721_with_metadata.functions.getRoleMember(
        TokenManagerErc721WithMetadataGenerator.TOKEN_REGISTRAR_ROLE, 0).call() == deployer_address: raise AssertionError
    if not token_manager_erc721_with_metadata.functions.hasRole(
        TokenManagerErc721WithMetadataGenerator.TOKEN_REGISTRAR_ROLE, deployer_address).call(): raise AssertionError
    if not token_manager_erc721_with_metadata.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: raise AssertionError
    if not token_manager_erc721_with_metadata.functions.tokenManagerLinker().call() == TOKEN_MANAGER_LINKER_ADDRESS: raise AssertionError
    if not token_manager_erc721_with_metadata.functions.communityLocker().call() == COMMUNITY_LOCKER_ADDRESS: raise AssertionError
    if not token_manager_erc721_with_metadata.functions.schainHash().call() == w3.solidity_keccak(['string'], [schain_name]): raise AssertionError
    if not token_manager_erc721_with_metadata.functions.depositBox().call() == deposit_box_address: raise AssertionError
    if token_manager_erc721_with_metadata.functions.automaticDeploy().call(): raise AssertionError
