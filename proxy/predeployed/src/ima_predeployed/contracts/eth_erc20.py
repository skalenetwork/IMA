from os.path import join, dirname
from typing import Dict

from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from ..addresses import TOKEN_MANAGER_ETH_ADDRESS
from predeployed_generator.openzeppelin.access_control_enumerable_generator import (
    AccessControlEnumerableGenerator
)
from web3 import Web3


class EthErc20Generator(AccessControlEnumerableGenerator):
    ARTIFACT_FILENAME = "EthErc20.json"
    META_FILENAME = "EthErc20.meta.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    MINTER_ROLE = Web3.solidity_keccak(['string'], ['MINTER_ROLE'])
    BURNER_ROLE = Web3.solidity_keccak(['string'], ['BURNER_ROLE'])
    NAME = 'ERC20 Ether Clone'
    SYMBOL = 'ETHC'
    DECIMALS = 18

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
    # -------ERC20Upgradeable-------
    # 201:  _balances
    # 202:  _allowances
    # 203:  _totalSupply
    # 204:  _name
    # 205:  _symbol
    # 206:  _decimals
    # 207:  __gap
    # ...   __gap
    # 250:  __gap
    # ---ERC20BurnableUpgradeable---
    # 251:  __gap
    # ...   __gap
    # 300:  __gap
    # -----------EthErc20-----------

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    NAME_SLOT = 204
    SYMBOL_SLOT = AccessControlEnumerableGenerator.next_slot(NAME_SLOT)
    DECIMALS_SLOT = AccessControlEnumerableGenerator.next_slot(SYMBOL_SLOT)

    def __init__(self):
        generator = EthErc20Generator.from_hardhat_artifact(
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
        cls._setup_role(storage, roles_slots, cls.MINTER_ROLE, [TOKEN_MANAGER_ETH_ADDRESS])
        cls._setup_role(storage, roles_slots, cls.BURNER_ROLE, [TOKEN_MANAGER_ETH_ADDRESS])
        cls._write_string(storage, cls.NAME_SLOT, cls.NAME)
        cls._write_string(storage, cls.SYMBOL_SLOT, cls.SYMBOL)
        cls._write_uint256(storage, cls.DECIMALS_SLOT, cls.DECIMALS)

        return storage


class UpgradeableEthErc20Generator(UpgradeableContractGenerator):
    """Generates upgradeable instance of EthErc20Upgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=EthErc20Generator())
