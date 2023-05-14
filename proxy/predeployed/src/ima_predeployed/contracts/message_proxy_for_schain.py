from os.path import join, dirname
from typing import Dict

from predeployed_generator.openzeppelin.access_control_enumerable_generator import (
    AccessControlEnumerableGenerator as Generator
)
from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from ..addresses import COMMUNITY_LOCKER_ADDRESS, KEY_STORAGE_ADDRESS, TOKEN_MANAGER_ERC1155_ADDRESS, \
    TOKEN_MANAGER_ERC20_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS, \
    TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS
from web3 import Web3
from pkg_resources import get_distribution


class MessageProxyForSchainGenerator(Generator):
    ARTIFACT_FILENAME = "MessageProxyForSchain.json"
    META_FILENAME = "MessageProxyForSchain.meta.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    CHAIN_CONNECTOR_ROLE = Web3.solidity_keccak(['string'], ['CHAIN_CONNECTOR_ROLE'])
    MAINNET_HASH = Web3.solidity_keccak(['string'], ['Mainnet'])
    GAS_LIMIT = 3000000
    ANY_SCHAIN = (0).to_bytes(32, 'big')

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
    # ---------MessageProxy--------
    # 201:  connectedChains
    # 202:  deprecatedRegistryContracts
    # 203:  gasLimit
    # ----MessageProxyForSchain----
    # 204:  keyStorage
    # 205:  schainHash
    # 206:  _outgoingMessageDataHash
    # 207:  _idxHead
    # 208:  _idxTail
    # 209:  _registryContracts
    # 210:  version

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    CONNECTED_CHAINS_SLOT = 201
    DEPRECATED_REGISTRY_CONTRACTS_SLOT = Generator.next_slot(CONNECTED_CHAINS_SLOT)
    GAS_LIMIT_SLOT = Generator.next_slot(DEPRECATED_REGISTRY_CONTRACTS_SLOT)
    KEY_STORAGE_SLOT = Generator.next_slot(GAS_LIMIT_SLOT)
    SCHAIN_HASH_SLOT = Generator.next_slot(KEY_STORAGE_SLOT)
    OUTGOING_MESSAGE_DATA_HASH = Generator.next_slot(SCHAIN_HASH_SLOT)
    IDX_HEAD = Generator.next_slot(OUTGOING_MESSAGE_DATA_HASH)
    IDX_TAIL = Generator.next_slot(IDX_HEAD)
    REGISTRY_CONTRACTS_SLOT = Generator.next_slot(IDX_TAIL)
    VERSION_SLOT = Generator.next_slot(REGISTRY_CONTRACTS_SLOT)
    
    def __init__(self):
        generator = MessageProxyForSchainGenerator.from_hardhat_artifact(
            join(dirname(__file__), '..', 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), '..', 'artifacts', self.META_FILENAME))
        super().__init__(bytecode=generator.bytecode, abi=generator.abi, meta=generator.meta)

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        deployer_address = kwargs['deployer_address']
        schain_name = kwargs['schain_name']
        storage: Dict[str, str] = {}
        roles_slots = cls.RolesSlots(roles=cls.ROLES_SLOT, role_members=cls.ROLE_MEMBERS_SLOT)
        
        cls._write_uint256(storage, cls.INITIALIZED_SLOT, 1)
        cls._setup_role(storage, roles_slots, cls.DEFAULT_ADMIN_ROLE, [deployer_address])
        cls._setup_role(storage, roles_slots, cls.CHAIN_CONNECTOR_ROLE,
                        [TOKEN_MANAGER_LINKER_ADDRESS])
        cls._write_address(storage, cls.KEY_STORAGE_SLOT, KEY_STORAGE_ADDRESS)
        cls._write_bytes32(storage, cls.SCHAIN_HASH_SLOT,
                           Web3.solidity_keccak(['string'], [schain_name]))

        connected_chain_info_slot = Generator.calculate_mapping_value_slot(
            cls.CONNECTED_CHAINS_SLOT, cls.MAINNET_HASH, 'bytes32')
        inited_slot = connected_chain_info_slot + 2
        cls._write_uint256(storage, inited_slot, 1)
        cls._write_uint256(storage, cls.GAS_LIMIT_SLOT, cls.GAS_LIMIT)
        cls._write_string(storage, cls.VERSION_SLOT,
                          get_distribution('ima_predeployed').version)
        registry_contracts_slot = Generator.calculate_mapping_value_slot(
            cls.REGISTRY_CONTRACTS_SLOT, cls.ANY_SCHAIN, 'bytes32')
        allowed_contracts = [
            TOKEN_MANAGER_ETH_ADDRESS,
            TOKEN_MANAGER_ERC20_ADDRESS,
            TOKEN_MANAGER_ERC721_ADDRESS,
            TOKEN_MANAGER_ERC1155_ADDRESS,
            TOKEN_MANAGER_ERC721_WITH_METADATA_ADDRESS,
            COMMUNITY_LOCKER_ADDRESS]
        values_slot = registry_contracts_slot
        indexes_slot = registry_contracts_slot + 1
        cls._write_uint256(storage, values_slot, len(allowed_contracts))
        for i, contract in enumerate(allowed_contracts):
            cls._write_address(
                storage,
                Generator.calculate_array_value_slot(values_slot, i),
                contract)
            cls._write_uint256(
                storage,
                Generator.calculate_mapping_value_slot(indexes_slot, int(contract, 16), 'uint256'),
                i + 1)
            
        return storage


class UpgradeableMessageProxyForSchainGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of MessageProxyForSchainUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=MessageProxyForSchainGenerator())
