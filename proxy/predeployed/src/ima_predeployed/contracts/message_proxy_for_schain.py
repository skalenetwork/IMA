from ..contract_generator import ContractGenerator, calculate_mapping_value_slot, next_slot
from ..addresses import COMMUNITY_LOCKER_ADDRESS, KEY_STORAGE_ADDRESS, TOKEN_MANAGER_ERC1155_ADDRESS,\
    TOKEN_MANAGER_ERC20_ADDRESS, TOKEN_MANAGER_ERC721_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS
from web3 import Web3


class MessageProxyForSchainGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "MessageProxyForSchain.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    MAINNET_HASH = Web3.solidityKeccak(['string'], ['Mainnet'])
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
    # 202:  registryContracts
    # 203:  gasLimit
    # ----MessageProxyForSchain----
    # 204:  keyStorage
    # 205:  schainHash
    # 206:  _outgoingMessageDataHash
    # 207:  _idxHead
    # 208:  _idxTail

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    CONNECTED_CHAINS_SLOT = 201
    REGISTRY_CONTRACTS_SLOT = next_slot(CONNECTED_CHAINS_SLOT)
    GAS_LIMIT_SLOT = next_slot(REGISTRY_CONTRACTS_SLOT)
    KEY_STORAGE_SLOT = next_slot(GAS_LIMIT_SLOT)
    SCHAIN_HASH_SLOT = next_slot(KEY_STORAGE_SLOT)

    def __init__(self, deployer_address: str, schain_name: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address, schain_name)

    # private

    def _setup(self, deployer_address: str, schain_name: str) -> None:
        self._write_uint256(self.INITIALIZED_SLOT, 1)
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._write_address(self.KEY_STORAGE_SLOT, KEY_STORAGE_ADDRESS)
        self._write_bytes32(self.SCHAIN_HASH_SLOT, Web3.solidityKeccak(['string'], [schain_name]))

        connected_chain_info_slot = calculate_mapping_value_slot(
            self.CONNECTED_CHAINS_SLOT, self.MAINNET_HASH, 'bytes32')
        inited_slot = connected_chain_info_slot + 2
        self._write_uint256(inited_slot, 1)
        self._write_uint256(self.GAS_LIMIT_SLOT, self.GAS_LIMIT)

        any_schain_contracts_slot = calculate_mapping_value_slot(
            self.REGISTRY_CONTRACTS_SLOT, self.ANY_SCHAIN, 'bytes32')
        allowed_contracts = [
            TOKEN_MANAGER_ETH_ADDRESS,
            TOKEN_MANAGER_ERC20_ADDRESS,
            TOKEN_MANAGER_ERC721_ADDRESS,
            TOKEN_MANAGER_ERC1155_ADDRESS,
            COMMUNITY_LOCKER_ADDRESS]
        for contract in allowed_contracts:
            contract_slot = calculate_mapping_value_slot(
                any_schain_contracts_slot, contract, 'address')
            self._write_uint256(contract_slot, 1)
