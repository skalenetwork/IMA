import json
import os


class ContractGenerator:
    bytecode = None
    storage = {}

    def __init__(self, artifact_filename: str):
        artifacts_dir = os.path.join(os.path.dirname(__file__), 'artifacts')
        artifacts_path = os.path.join(artifacts_dir, artifact_filename)
        with open(artifacts_path, encoding='utf-8') as fp:
            contract = json.load(fp)
            self.bytecode = contract['deployedBytecode']

    def generate_contract(self, balance: int = 0, nonce: int = 0) -> dict:
        assert isinstance(self.bytecode, str)
        assert isinstance(self.storage, dict)
        contract = {
            'code': self.bytecode,
            'balance': hex(balance)
        }
        if self.storage:
            contract['storage'] = self.storage
        if nonce > 0:
            contract['nonce'] = nonce
        return contract

    # private

    def _write_address(self, slot: int, address: str) -> None:
        self.storage[hex(slot)] = address.lower()
