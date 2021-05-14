import json
import os


def to_even_length(hex_string: str) -> str:
    assert hex_string.startswith('0x')
    if len(hex_string) % 2 != 0:
        return "0x0" + hex_string[2:]
    else:
        return hex_string


def add_0x(bytes_string: str) -> str:
    if bytes_string.startswith('0x'):
        return bytes_string
    else:
        return '0x' + bytes_string


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
            'balance': str(balance)
        }
        if self.storage:
            contract['storage'] = self.storage
        if nonce > 0:
            contract['nonce'] = nonce
        return contract

    # private

    def _write_address(self, slot: int, address: str) -> None:
        self.storage[to_even_length(hex(slot))] = address.lower()

    def _write_bytes32(self, slot: int, data: bytes) -> None:
        assert len(data) <= 32
        self.storage[to_even_length(hex(slot))] = to_even_length(add_0x(data.hex()))


