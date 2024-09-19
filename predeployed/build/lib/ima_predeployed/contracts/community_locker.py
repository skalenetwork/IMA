from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS
from ima_predeployed.contract_generator import ContractGenerator, next_slot
from tools import w3


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
    # --AccessControlUpgradeable---
    # 51:   _roles
    # 52:   __gap
    # ...   __gap
    # 100:  __gap
    # -------CommunityLocker-------
    # 101:  messageProxy
    # 102:  tokenManagerLinker
    # 103:  schainHash
    # 104:  timeLimitPerMessage
    # 105:  _unfrozenUsers
    # 106:  _lastMessageTimeStamp

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 51
    MESSAGE_PROXY_SLOT = 101
    TOKEN_MANAGER_LINKER_SLOT = next_slot(MESSAGE_PROXY_SLOT)
    SCHAIN_HASH_SLOT = next_slot(TOKEN_MANAGER_LINKER_SLOT)
    TIME_LIMIT_PER_MESSAGE_SLOT = next_slot(SCHAIN_HASH_SLOT)

    def __init__(self, deployer_address: str, schain_name: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address, schain_name)

    # private

    def _setup(self, deployer_address: str, schain_name: str) -> None:
        self._write_uint256(self.INITIALIZED_SLOT, 1)
        self._setup_role(self.ROLES_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._write_address(self.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        self._write_address(self.TOKEN_MANAGER_LINKER_SLOT, TOKEN_MANAGER_LINKER_ADDRESS)
        self._write_bytes32(self.SCHAIN_HASH_SLOT, w3.solidityKeccak(['string'], [schain_name]))
        self._write_uint256(self.TIME_LIMIT_PER_MESSAGE_SLOT, self.DEFAULT_TIME_LIMIT_SEC)
