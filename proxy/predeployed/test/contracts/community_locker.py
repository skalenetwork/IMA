from ima_predeployed.addresses import COMMUNITY_LOCKER_ADDRESS, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, \
    TOKEN_MANAGER_LINKER_ADDRESS
from ima_predeployed.contracts.community_locker import CommunityLockerGenerator
from tools import w3, load_abi


def check_community_locker(deployer_address: str, schain_name: str, community_pool_address) -> None:
    community_locker = w3.eth.contract(
        address=COMMUNITY_LOCKER_ADDRESS, abi=load_abi(CommunityLockerGenerator.ARTIFACT_FILENAME))
    if not community_locker.functions.getRoleMember(
        CommunityLockerGenerator.DEFAULT_ADMIN_ROLE, 0).call() == deployer_address: raise AssertionError
    if not community_locker.functions.hasRole(CommunityLockerGenerator.DEFAULT_ADMIN_ROLE, deployer_address).call(): raise AssertionError
    if not community_locker.functions.messageProxy().call() == MESSAGE_PROXY_FOR_SCHAIN_ADDRESS: raise AssertionError
    if not community_locker.functions.tokenManagerLinker().call() == TOKEN_MANAGER_LINKER_ADDRESS: raise AssertionError
    if not community_locker.functions.communityPool().call() == community_pool_address: raise AssertionError
    if not community_locker.functions.schainHash().call() == w3.solidityKeccak(['string'], [schain_name]): raise AssertionError
    if not community_locker.functions.timeLimitPerMessage(CommunityLockerGenerator.MAINNET_HASH).call() == CommunityLockerGenerator.DEFAULT_TIME_LIMIT_SEC: raise AssertionError
