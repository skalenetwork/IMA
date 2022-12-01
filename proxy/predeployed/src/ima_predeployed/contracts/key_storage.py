from os.path import join, dirname
from typing import Dict

from predeployed_generator.openzeppelin.access_control_enumerable_generator import (
    AccessControlEnumerableGenerator
)
from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator


class KeyStorageGenerator(AccessControlEnumerableGenerator):
    ARTIFACT_FILENAME = "KeyStorage.json"
    META_FILENAME = "KeyStorage.meta.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')

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
    # ----------KeyStorage----------

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151

    def __init__(self):
        generator = KeyStorageGenerator.from_hardhat_artifact(
            join(dirname(__file__), '..', 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), '..', 'artifacts', self.META_FILENAME))
        super().__init__(bytecode=generator.bytecode, abi=generator.abi, meta=generator.meta)

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        deployer_address = kwargs['deployer_address']
        storage: Dict[str, str] = {}
        roles_slots = cls.RolesSlots(roles=cls.ROLES_SLOT, role_members=cls.ROLE_MEMBERS_SLOT)

        cls._write_uint256(storage, cls.INITIALIZED_SLOT, 1)
        cls._setup_role(storage, roles_slots, cls.DEFAULT_ADMIN_ROLE, [deployer_address])

        return storage


class UpgradeableKeyStorageGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of KeyStorageUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=KeyStorageGenerator())
