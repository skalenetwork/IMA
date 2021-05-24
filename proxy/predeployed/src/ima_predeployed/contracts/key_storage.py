from ..contract_generator import ContractGenerator, calculate_mapping_value_slot, calculate_array_value_slot
from ..addresses import KEY_STORAGE_ADDRESS
from web3 import Web3


class KeyStorageGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "KeyStorage.json"
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
    # ----KeyStorage----

    ROLES_SLOT = 51

    def __init__(self, deployer_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address)

    # private

    def _setup(self, deployer_address: str) -> None:
        self._setup_role(self.ROLES_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
