from ..contract_generator import ContractGenerator


class AdminUpgradeabilityProxyGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "AdminUpgradeabilityProxy.json"
    IMPLEMENTATION_SLOT = int('0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', 16)
    ADMIN_SLOT = int('0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103', 16)

    def __init__(self, logic_address: str, admin_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(logic_address, admin_address)

    # private

    def _setup(self, logic_address: str, admin_address: str) -> None:
        self._write_address(self.IMPLEMENTATION_SLOT, logic_address)
        self._write_address(self.ADMIN_SLOT, admin_address)
