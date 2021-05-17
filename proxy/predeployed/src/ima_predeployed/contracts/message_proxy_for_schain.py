from ..contract_generator import ContractGenerator, calculate_mapping_value_slot


class MessageProxyForSchainGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "MessageProxyForSchain.json"
    DEFAULT_ADMIN_ROLE = 0

    def __init__(self, deployer_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address)

    # private

    def _setup(self, deployer_address: str) -> None:
        self._setup_role(0, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        # gap 49
