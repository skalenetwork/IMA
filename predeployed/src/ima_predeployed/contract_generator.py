import json
import os
from web3 import Web3


def to_even_length(hex_string: str) -> str:
    a_res = hex_string.startswith('0x')
    if __debug__:
        if not a_res: raise AssertionError
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
    if key_type == 'address':
        return calculate_mapping_value_slot(slot, int(key, 16).to_bytes(32, 'big'), 'bytes32')
    else:
        return int.from_bytes(Web3.solidity_keccak([key_type, 'uint256'], [key, slot]), 'big')


def calculate_array_value_slot(slot: int, index: int) -> int:
    return int.from_bytes(Web3.solidity_keccak(['uint256'], [slot]), 'big') + index


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
        a_res = isinstance(self.bytecode, str)
        if __debug__:
            if not a_res: raise AssertionError
        a_res = isinstance(self.storage, dict)
        if __debug__:
            if not a_res: raise AssertionError
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
        data_length = len(data)
        if __debug__:
            if not ( data_length <= 32 ): raise AssertionError
        self.storage[to_even_length(hex(slot))] = to_even_length(add_0x(data.hex()))

    def _write_uint256(self, slot: int, value: int) -> None:
        self.storage[to_even_length(hex(slot))] = to_even_length(add_0x(hex(value)))

    def _setup_role(self, roles_slot: int, role_members_slot: int, role: bytes, accounts: [str]):
        role_data_slot = calculate_mapping_value_slot(roles_slot, role, 'bytes32')
        members_slot = role_data_slot
        role_members_value_slot = calculate_mapping_value_slot(role_members_slot, role, 'bytes32')
        values_slot = role_members_value_slot
        indexes_slot = role_members_value_slot + 1
        self._write_uint256(values_slot, len(accounts))
        for i, account in enumerate(accounts):
            members_value_slot = calculate_mapping_value_slot(members_slot, account, 'address')
            self._write_uint256(members_value_slot, 1)
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
