from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS, \
    COMMUNITY_LOCKER_ADDRESS
from ima_predeployed.contract_generator import ContractGenerator, next_slot
from web3 import Web3


class TokenManagerGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "TokenManager.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    AUTOMATIC_DEPLOY_ROLE = Web3.solidityKeccak(['string'], ['AUTOMATIC_DEPLOY_ROLE'])
    TOKEN_REGISTRAR_ROLE = Web3.solidityKeccak(['string'], ['TOKEN_REGISTRAR_ROLE'])

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
    TOKEN_MANAGER_LINKER_SLOT = next_slot(MESSAGE_PROXY_SLOT)
    COMMUNITY_LOCKER_SLOT = next_slot(TOKEN_MANAGER_LINKER_SLOT)
    SCHAIN_HASH_SLOT = next_slot(COMMUNITY_LOCKER_SLOT)
    DEPOSIT_BOX_SLOT = next_slot(SCHAIN_HASH_SLOT)
    AUTOMATIC_DEPLOY_SLOT = DEPOSIT_BOX_SLOT
    TOKEN_MANAGERS_SLOT = next_slot(AUTOMATIC_DEPLOY_SLOT)

    def __init__(self, deployer_address: str, deposit_box_address: str, schain_name: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup_token_manager(deployer_address, deposit_box_address, schain_name)

    # private

    def _setup_token_manager(self, deployer_address: str, deposit_box_address: str, schain_name: str) -> None:
        self._write_uint256(self.INITIALIZED_SLOT, 1)
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.AUTOMATIC_DEPLOY_ROLE, [deployer_address])
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.TOKEN_REGISTRAR_ROLE, [deployer_address])
        self._write_address(self.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        self._write_address(self.TOKEN_MANAGER_LINKER_SLOT, TOKEN_MANAGER_LINKER_ADDRESS)
        self._write_address(self.COMMUNITY_LOCKER_SLOT, COMMUNITY_LOCKER_ADDRESS)
        self._write_bytes32(self.SCHAIN_HASH_SLOT, Web3.solidityKeccak(['string'], [schain_name]))
        self._write_address(self.DEPOSIT_BOX_SLOT, deposit_box_address)
