import json
import os
from web3 import Web3


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


def calculate_mapping_value_slot(slot: int, key: any, key_type: str) -> int:
    return int.from_bytes(Web3.solidityKeccak([key_type, 'uint256'], [key, slot]), 'big')


def calculate_array_value_slot(slot: int, index: int) -> int:
    return int.from_bytes(Web3.solidityKeccak(['uint256'], [slot]), 'big') + index


def next_slot(previous_slot: int) -> int:
    return previous_slot + 1


class ContractGenerator:
    def __init__(self, artifact_filename: str):
        artifacts_dir = os.path.join(os.path.dirname(__file__), 'artifacts')
        artifacts_path = os.path.join(artifacts_dir, artifact_filename)
        with open(artifacts_path, encoding='utf-8') as fp:
            contract = json.load(fp)
            self.bytecode = contract['deployedBytecode']
            self.abi = contract['abi']
            self.storage = {}

    def generate_contract(self, balance: int = 0, nonce: int = 0) -> dict:
        assert isinstance(self.bytecode, str)
        assert isinstance(self.storage, dict)
        return {
            'code': self.bytecode,
            'balance': str(balance),
            'nonce': str(nonce),
            'storage': self.storage
        }

    # private

    def _write_address(self, slot: int, address: str) -> None:
        self.storage[to_even_length(hex(slot))] = address.lower()

    def _write_bytes32(self, slot: int, data: bytes) -> None:
        assert len(data) <= 32
        self.storage[to_even_length(hex(slot))] = to_even_length(add_0x(data.hex()))

    def _write_uint256(self, slot: int, value: int) -> None:
        self.storage[to_even_length(hex(slot))] = to_even_length(add_0x(hex(value)))

    def _setup_role(self, slot: int, role: bytes, accounts: [str]):
        role_data_slot = calculate_mapping_value_slot(slot, role, 'bytes32')
        members_slot = role_data_slot
        values_slot = members_slot
        indexes_slot = members_slot + 1
        self._write_uint256(values_slot, len(accounts))
        for i, account in enumerate(accounts):
            self._write_address(calculate_array_value_slot(values_slot, i), account)
            self._write_uint256(calculate_mapping_value_slot(indexes_slot, int(account, 16), 'uint256'), i + 1)

    def _write_addresses_array(self, slot: int, values: list) -> None:
        self._write_uint256(slot, len(values))
        for i, address in enumerate(values):
            address_slot = calculate_array_value_slot(slot, i)
            self._write_address(address_slot, address)

    def _write_string(self, slot: int, value: str) -> None:
        binary = value.encode()
        length = len(binary)
        if length < 32:
            binary += (2 * length).to_bytes(32 - length, 'big')
            self._write_bytes32(slot, binary)
        else:
            self._write_uint256(slot, 2 * length + 1)

            def chunks(size, source):
                for i in range(0, len(source), size):
                    yield source[i:i + size]

            for index, data in enumerate(chunks(32, binary)):
                if len(data) < 32:
                    data += int(0).to_bytes(32 - len(data), 'big')
                self._write_bytes32(calculate_array_value_slot(slot, index), data)
