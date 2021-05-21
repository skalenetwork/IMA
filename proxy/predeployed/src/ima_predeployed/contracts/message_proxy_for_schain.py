from ..contract_generator import ContractGenerator, calculate_mapping_value_slot, calculate_array_value_slot
from ..addresses import KEY_STORAGE_ADDRESS


class MessageProxyForSchainGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "MessageProxyForSchain.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')

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
    # ----MessageProxyForSchain----
    # 101: keyStorage

    ROLES_SLOT = 51
    KEY_STORAGE_SLOT = 101

    def __init__(self, deployer_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address)

    # private

    def _setup(self, deployer_address: str) -> None:
        self._setup_role(self.ROLES_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._write_address(self.KEY_STORAGE_SLOT, KEY_STORAGE_ADDRESS)
