from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS
from ima_predeployed.contract_generator import ContractGenerator, next_slot
from web3 import Web3


class CommunityLockerGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "CommunityLocker.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    DEFAULT_TIME_LIMIT_SEC = 5 * 60

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
    # 205:  timeLimitPerMessage
    # 206:  _unfrozenUsers
    # 207:  _lastMessageTimeStamp

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    MESSAGE_PROXY_SLOT = 201
    TOKEN_MANAGER_LINKER_SLOT = next_slot(MESSAGE_PROXY_SLOT)
    COMMUNITY_POOL_SLOT = next_slot(TOKEN_MANAGER_LINKER_SLOT)
    SCHAIN_HASH_SLOT = next_slot(COMMUNITY_POOL_SLOT)
    TIME_LIMIT_PER_MESSAGE_SLOT = next_slot(SCHAIN_HASH_SLOT)

    def __init__(self, deployer_address: str, schain_name: str, community_pool_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address, schain_name, community_pool_address)

    # private

    def _setup(self, deployer_address: str, schain_name: str, community_pool_address) -> None:
        self._write_uint256(self.INITIALIZED_SLOT, 1)
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._write_address(self.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        self._write_address(self.TOKEN_MANAGER_LINKER_SLOT, TOKEN_MANAGER_LINKER_ADDRESS)
        self._write_address(self.COMMUNITY_POOL_SLOT, community_pool_address)
        self._write_bytes32(self.SCHAIN_HASH_SLOT, Web3.solidityKeccak(['string'], [schain_name]))
        self._write_uint256(self.TIME_LIMIT_PER_MESSAGE_SLOT, self.DEFAULT_TIME_LIMIT_SEC)
