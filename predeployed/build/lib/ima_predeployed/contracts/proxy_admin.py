from ..contract_generator import ContractGenerator


class ProxyAdminGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "ProxyAdmin.json"

    def __init__(self, owner_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(owner_address)

    # private

    def _setup(self, owner_address: str) -> None:
        self._write_address(0, owner_address)
