from os.path import join, dirname
from typing import Dict

from predeployed_generator.openzeppelin.access_control_enumerable_generator import (
    AccessControlEnumerableGenerator as Generator
)
from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from ..addresses import (
    MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS,
    TOKEN_MANAGER_ERC721_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS,
    TOKEN_MANAGER_ERC1155_ADDRESS, TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS)
from web3 import Web3


class TokenManagerLinkerGenerator(Generator):
    ARTIFACT_FILENAME = "TokenManagerLinker.json"
    META_FILENAME = "TokenManagerLinker.meta.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    REGISTRAR_ROLE = Web3.solidity_keccak(['string'], ['REGISTRAR_ROLE'])

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
    # ------TokenManagerLinker------
    # 201:  messageProxy
    # 202:  linkerAddress
    # 203:  tokenManagers
    # 204:  interchainConnections

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    MESSAGE_PROXY_SLOT = 201
    LINKER_ADDRESS_SLOT = Generator.next_slot(MESSAGE_PROXY_SLOT)
    TOKEN_MANAGERS_SLOT = Generator.next_slot(LINKER_ADDRESS_SLOT)

    def __init__(self):
        generator = TokenManagerLinkerGenerator.from_hardhat_artifact(
            join(dirname(__file__), '..', 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), '..', 'artifacts', self.META_FILENAME))
        super().__init__(bytecode=generator.bytecode, abi=generator.abi, meta=generator.meta)

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        deployer_address = kwargs['deployer_address']
        linker_addres = kwargs['linker_address']
        storage: Dict[str, str] = {}
        roles_slots = cls.RolesSlots(roles=cls.ROLES_SLOT, role_members=cls.ROLE_MEMBERS_SLOT)

        cls._write_uint256(storage, cls.INITIALIZED_SLOT, 1)
        cls._setup_role(storage, roles_slots, cls.DEFAULT_ADMIN_ROLE, [deployer_address])
        cls._setup_role(storage, roles_slots, cls.REGISTRAR_ROLE, [deployer_address])
        cls._write_address(storage, cls.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        cls._write_address(storage, cls.LINKER_ADDRESS_SLOT, linker_addres)
        cls._write_addresses_array(
            storage,
            cls.TOKEN_MANAGERS_SLOT, [
                TOKEN_MANAGER_ETH_ADDRESS,
                TOKEN_MANAGER_ERC20_ADDRESS,
                TOKEN_MANAGER_ERC721_ADDRESS,
                TOKEN_MANAGER_ERC1155_ADDRESS,
                TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS])
        return storage


class UpgradeableTokenManagerLinkerGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of TokenManagerLinkerUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=TokenManagerLinkerGenerator())
