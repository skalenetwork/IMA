from .contract_generator import ContractGenerator
from .contracts.admin_upgradeability_proxy import AdminUpgradeabilityProxyGenerator


class UpgradeableContractGenerator(AdminUpgradeabilityProxyGenerator):
    def __init__(self, implementation_address: str, proxy_admin_address, implementation_generator: ContractGenerator):
        super().__init__(implementation_address, proxy_admin_address)
        self.implementation_generator = implementation_generator

    def generate_contract(self, balance: int = 0, nonce: int = 0) -> dict:
        contract = super().generate_contract(balance, nonce)
        contract['storage'].update(self.implementation_generator.generate_contract(balance, nonce)['storage'])
        return contract
