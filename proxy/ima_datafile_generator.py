import os
import sys
import json
import subprocess


CONTRACTS_METADATA = {
    'skale_features': {
        'address': '0xc033b369416c9ecd8e4a07aafa8b06b4107419e2',
        'filename': 'SkaleFeatures'
    },
    'lock_and_data_for_schain': {
        'address': '0x47cf4c2d6891377952a7e0e08a6f17180a91a0f9',
        'filename': 'LockAndDataForSchain'
    },
    'eth_erc20': {
        'address': '0xd3cdbc1b727b2ed91b8ad21333841d2e96f255af',
        'filename': 'EthERC20'
    },
    'token_manager': {
        'address': '0x57ad607c6e90df7d7f158985c3e436007a15d744',
        'filename': 'TokenManager'
    },
    'lock_and_data_for_schain_erc20': {
        'address': '0xc7085eb0ba5c2d449e80c22d6da8f0edbb86dd82',
        'filename': 'LockAndDataForSchainERC20'
    },
    'erc20_module_for_schain': {
        'address': '0xc30516c1dedfa91a948349209da6d6b1c8868ed7',
        'filename': 'ERC20ModuleForSchain'
    },
    'lock_and_data_for_schain_erc721': {
        'address': '0x97438fdfbdcc4ccc533ea874bfeb71f4098585ab',
        'filename': 'LockAndDataForSchainERC721'
    },
    'erc721_module_for_schain': {
        'address': '0xc1b336da9058efd1e9f5636a70bfe2ec17e15abb',
        'filename': 'ERC721ModuleForSchain'
    },
    'token_factory': {
        'address': '0xe9e8e031685137c3014793bef2875419c304aa72',
        'filename': 'TokenFactory'
    },
    'message_proxy_chain': {
        'address': '0x427c74e358eb1f620e71f64afc9b1b5d2309dd01',
        'filename': 'MessageProxyForSchain'
    }
}

def get_git_revision_hash():
    return subprocess.check_output(['git', 'rev-parse', 'HEAD']).strip().decode("utf-8")


def generate_ima_data_file(artifacts_folder, results_folder):
    ima_data = {
        'ima_commit_hash': get_git_revision_hash()
    }
    ima_data_filepath = os.path.join(results_folder, 'ima_data.json')
    for name in CONTRACTS_METADATA:
        contract = CONTRACTS_METADATA[name]
        filepath = os.path.join(artifacts_folder, f'{contract["filename"]}.json')
        with open(filepath) as f:
            contract_data = json.load(f)
        ima_data[f'{name}_address'] = contract['address']
        ima_data[f'{name}_abi'] = contract_data['abi']
        ima_data[f'{name}_bytecode'] = contract_data['bytecode']
    with open(ima_data_filepath, 'w') as json_file:
        json.dump(ima_data, json_file, indent=4)


if __name__ == "__main__":
    artifacts_folder = os.environ['ARTIFACTS_FOLDER']
    results_folder = os.environ['RESULTS_FOLDER']
    generate_ima_data_file(sys.argv[1], sys.argv[2])
