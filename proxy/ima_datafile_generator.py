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
        'address': '0x33FD737F306C2BD2eE6019279FbA0e1ffED76486',
        'filename': 'LockAndDataForSchain'
    },
    'message_proxy_chain': {
        'address': '0xe0051Ae016D3A704131926E9B969dfCabca12Cc4',
        'filename': 'MessageProxyForSchain'
    },
    'token_manager': {
        'address': '0xAFB14696B408eb01ca1471bA8a72b9Df2dB66feC',
        'filename': 'TokenManager'
    },
    'eth_erc20': {
        'address': '0x0FEae1EAA782CD53435306f2aeDb754ca665Ff8f',
        'filename': 'EthERC20'
    },
    'erc20_module_for_schain': {
        'address': '0x28d5fe6002342E6DEc3D8409d4b5418BaFac8096',
        'filename': 'ERC20ModuleForSchain'
    },
    'erc721_module_for_schain': {
        'address': '0x2c17e8E555131Dc13C884CD1FFFD0a8957C28b85',
        'filename': 'ERC721ModuleForSchain'
    },
    'lock_and_data_for_schain_erc20': {
        'address': '0x6D089DdDb21Fd06fce339e9B1a1216560977d489',
        'filename': 'LockAndDataForSchainERC20'
    },
    'lock_and_data_for_schain_erc721': {
        'address': '0x0C5a2642b605D546aC7FDC47c95ED5363307254d',
        'filename': 'LockAndDataForSchainERC721'
    },
    'token_factory': {
        'address': '0x421166B33d977c934f04f3FB1BfF106f0a13C5E0',
        'filename': 'TokenFactory'
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
        ima_data[f'{name}_bytecode'] = contract_data['deployedBytecode'] # not 'bytecode'
    with open(ima_data_filepath, 'w') as json_file:
        json.dump(ima_data, json_file, indent=4)


if __name__ == "__main__":
    generate_ima_data_file(sys.argv[1], sys.argv[2])
