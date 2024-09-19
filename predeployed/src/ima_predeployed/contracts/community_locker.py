from os.path import join, dirname
from typing import Dict

from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from ..addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS
from predeployed_generator.openzeppelin.access_control_enumerable_generator import (
    AccessControlEnumerableGenerator
)
from web3 import Web3


class CommunityLockerGenerator(AccessControlEnumerableGenerator):
    ARTIFACT_FILENAME = 'CommunityLocker.json'
    META_FILENAME = 'CommunityLocker.meta.json'
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    DEFAULT_TIME_LIMIT_SEC = 5 * 60
    MAINNET_HASH = Web3.solidity_keccak(['string'], ['Mainnet'])

    # ---------- storage ----------
    # --------Initializable--------
    # 0:    _initialized, _initializing;
    # -----ContextUpgradeable------
    # 1:    __gap
    # ...   __gap
    # 50:   __gap
    # ------ERC165Upgradeable------
    # 51:   __gap
    # ...   __gap
    # 100:  __gap
    # --AccessControlUpgradeable---
    # 101:  _roles
    # 102:  __gap
    # ...   __gap
    # 150:  __gap
    # AccessControlEnumerableUpgradeable
    # 151:  _roleMembers
    # 152:  __gap
    # ...   __gap
    # 200:  __gap
    # -------CommunityLocker-------
    # 201:  messageProxy
    # 202:  tokenManagerLinker
    # 203:  communityPool
    # 204:  schainHash
    # 205:  _deprecatedTimeLimitPerMessage
    # 206:  activeUsers
    # 207:  lastMessageTimeStamp
    # 208:  mainnetGasPrice
    # 209:  gasPriceTimestamp
    # 210:  timeLimitPerMessage
    # 211:  lastMessageTimeStampToSchain

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    MESSAGE_PROXY_SLOT = 201
    TOKEN_MANAGER_LINKER_SLOT = AccessControlEnumerableGenerator.next_slot(MESSAGE_PROXY_SLOT)
    COMMUNITY_POOL_SLOT = AccessControlEnumerableGenerator.next_slot(TOKEN_MANAGER_LINKER_SLOT)
    SCHAIN_HASH_SLOT = AccessControlEnumerableGenerator.next_slot(COMMUNITY_POOL_SLOT)
    TIME_LIMIT_PER_MESSAGE_SLOT = 210

    def __init__(self):
        generator = CommunityLockerGenerator.from_hardhat_artifact(
            join(dirname(__file__), '..', 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), '..', 'artifacts', self.META_FILENAME))
        super().__init__(bytecode=generator.bytecode, abi=generator.abi, meta=generator.meta)

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        deployer_address = kwargs['deployer_address']
        schain_name = kwargs['schain_name']
        community_pool_address = kwargs['community_pool_address']

        storage: Dict[str, str] = {}
        roles_slots = cls.RolesSlots(roles=cls.ROLES_SLOT, role_members=cls.ROLE_MEMBERS_SLOT)

        cls._write_uint256(storage, cls.INITIALIZED_SLOT, 1)
        cls._setup_role(storage, roles_slots, cls.DEFAULT_ADMIN_ROLE, [deployer_address])
        cls._write_address(storage, cls.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        cls._write_address(storage, cls.TOKEN_MANAGER_LINKER_SLOT, TOKEN_MANAGER_LINKER_ADDRESS)
        cls._write_address(storage, cls.COMMUNITY_POOL_SLOT, community_pool_address)

        cls._write_bytes32(storage, cls.SCHAIN_HASH_SLOT, Web3.solidity_keccak(['string'], [schain_name]))
        time_limit_per_message_slot = AccessControlEnumerableGenerator.calculate_mapping_value_slot(
            cls.TIME_LIMIT_PER_MESSAGE_SLOT, cls.MAINNET_HASH, 'bytes32')
        cls._write_uint256(storage, time_limit_per_message_slot, cls.DEFAULT_TIME_LIMIT_SEC)

        return storage


class UpgradeableCommunityLockerGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of CommunityLockerUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=CommunityLockerGenerator())
