from ..contract_generator import ContractGenerator


class ProxyAdminGenerator(ContractGenerator):
    artifact_filename = "ProxyAdmin.json"

    def __init__(self, owner_address: str):
        super().__init__(self.artifact_filename)
        self._setup(owner_address)

    # private

    def _setup(self, owner_address: str) -> None:
        self._write_address(0, owner_address)
