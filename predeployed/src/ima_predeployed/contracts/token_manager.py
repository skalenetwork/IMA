from os.path import join, dirname
from typing import Dict

from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from ..addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS, \
    COMMUNITY_LOCKER_ADDRESS
from predeployed_generator.openzeppelin.access_control_enumerable_generator import (
    AccessControlEnumerableGenerator as Generator
)
from web3 import Web3


class TokenManagerGenerator(Generator):
    ARTIFACT_FILENAME = "TokenManager.json"
    META_FILENAME = "TokenManager.meta.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    AUTOMATIC_DEPLOY_ROLE = Web3.solidity_keccak(['string'], ['AUTOMATIC_DEPLOY_ROLE'])
    TOKEN_REGISTRAR_ROLE = Web3.solidity_keccak(['string'], ['TOKEN_REGISTRAR_ROLE'])

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
    # ---------TokenManager---------
    # 201:  messageProxy
    # 202:  tokenManagerLinker
    # 203:  communityLocker
    # 204:  schainHash
    # 205:  depositBox, automaticDeploy
    # 206:  tokenManagers

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    MESSAGE_PROXY_SLOT = 201
    TOKEN_MANAGER_LINKER_SLOT = Generator.next_slot(MESSAGE_PROXY_SLOT)
    COMMUNITY_LOCKER_SLOT = Generator.next_slot(TOKEN_MANAGER_LINKER_SLOT)
    SCHAIN_HASH_SLOT = Generator.next_slot(COMMUNITY_LOCKER_SLOT)
    DEPOSIT_BOX_SLOT = Generator.next_slot(SCHAIN_HASH_SLOT)
    AUTOMATIC_DEPLOY_SLOT = DEPOSIT_BOX_SLOT
    TOKEN_MANAGERS_SLOT = Generator.next_slot(AUTOMATIC_DEPLOY_SLOT)

    def __init__(self):
        generator = TokenManagerGenerator.from_hardhat_artifact(
            join(dirname(__file__), '..', 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), '..', 'artifacts', self.META_FILENAME))
        super().__init__(bytecode=generator.bytecode, abi=generator.abi, meta=generator.meta)

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        deployer_address = kwargs['deployer_address']
        schain_name = kwargs['schain_name']
        deposit_box_address = kwargs['deposit_box_address']
        storage: Dict[str, str] = {}
        roles_slots = cls.RolesSlots(roles=cls.ROLES_SLOT, role_members=cls.ROLE_MEMBERS_SLOT)
        
        cls._write_uint256(storage, cls.INITIALIZED_SLOT, 1)
        cls._setup_role(storage, roles_slots, cls.DEFAULT_ADMIN_ROLE, [deployer_address])
        cls._setup_role(storage, roles_slots, cls.AUTOMATIC_DEPLOY_ROLE, [deployer_address])
        cls._setup_role(storage, roles_slots, cls.TOKEN_REGISTRAR_ROLE, [deployer_address])
        cls._write_address(storage, cls.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        cls._write_address(storage, cls.TOKEN_MANAGER_LINKER_SLOT, TOKEN_MANAGER_LINKER_ADDRESS)
        cls._write_address(storage, cls.COMMUNITY_LOCKER_SLOT, COMMUNITY_LOCKER_ADDRESS)
        cls._write_bytes32(storage, cls.SCHAIN_HASH_SLOT, Web3.solidity_keccak(['string'], [schain_name]))
        cls._write_address(storage, cls.DEPOSIT_BOX_SLOT, deposit_box_address)
        
        return storage


class UpgradeableTokenManagerGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of TokenManagerUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=TokenManagerGenerator())
