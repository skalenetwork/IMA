import os
import sys
import json
import subprocess


CONTRACTS_METADATA = {
    'skale_features': {
        'address': '0xc033b369416c9ecd8e4a07aafa8b06b4107419e2',
        'solname': 'SkaleFeatures',
        'filepath': 'artifacts/contracts/schain/SkaleFeatures.sol/SkaleFeatures.json'
    },
    'token_manager_eth': {
        'address': '0x47cf4c2d6891377952a7e0e08a6f17180a91a0f9',
        'solname': 'TokenManagerEth',
        'filepath': 'artifacts/contracts/schain/TokenManagers/TokenManagerEth.sol/TokenManagerEth.json'
    },
    'token_manager_erc20': {
        'address': '0xc7085eb0ba5c2d449e80c22d6da8f0edbb86dd82',
        'solname': 'TokenManagerERC20',
        'filepath': 'artifacts/contracts/schain/TokenManagers/TokenManagerERC20.sol/TokenManagerERC20.json'
    },
    'token_manager_erc721': {
        'address': '0x97438fdfbdcc4ccc533ea874bfeb71f4098585ab',
        'solname': 'TokenManagerERC721',
        'filepath': 'artifacts/contracts/schain/TokenManagers/TokenManagerERC721.sol/TokenManagerERC721.json'
    },
    'token_manager_erc1155': {
        'address': '0xa13095db73dc4afeff48c625d153b17ab668990d',
        'solname': 'TokenManagerERC1155',
        'filepath': 'artifacts/contracts/schain/TokenManagers/TokenManagerERC721.sol/TokenManagerERC1155.json'
    },
    'message_proxy_chain': {
        'address': '0x427c74e358eb1f620e71f64afc9b1b5d2309dd01',
        'solname': 'MessageProxyForSchain',
        'filepath': 'artifacts/contracts/schain/MessageProxyForSchain.sol/MessageProxyForSchain.json'
    },
    'token_manager_linker': {
        'address': '0x57ad607c6e90df7d7f158985c3e436007a15d744',
        'solname': 'TokenManagerLinker',
        'filepath': 'artifacts/contracts/schain/TokenManagerLinker.sol/TokenManagerLinker.json'
    },
    'eth_erc20': {
        'address': '0xd3cdbc1b727b2ed91b8ad21333841d2e96f255af',
        'solname': 'EthERC20',
        'filepath': 'artifacts/contracts/schain/tokens/EthERC20.sol/EthERC20.json'
    },
    'community_locker': {
        'address': '0xe6489fd3d2176832D82AF91467f650B15e654C77',
        'solname': 'CommunityLocker',
        'filepath': 'artifacts/contracts/schain/CommunityLocker.sol/CommunityLocker.json'
    },
}

def get_git_revision_hash():
    return subprocess.check_output(['git', 'rev-parse', 'HEAD']).strip().decode("utf-8")


def generate_ima_data_file(results_folder):
    ima_data = {
        'ima_commit_hash': get_git_revision_hash()
    }
    ima_data_filepath = os.path.join(results_folder, 'ima_data.json')
    for name in CONTRACTS_METADATA:
        contract = CONTRACTS_METADATA[name]
        filepath = contract['filepath']
        with open(filepath) as f:
            contract_data = json.load(f)
        ima_data[f'{name}_address'] = contract['address']
        ima_data[f'{name}_abi'] = contract_data['abi']
        ima_data[f'{name}_bytecode'] = contract_data['deployedBytecode'] # not 'bytecode'
    with open(ima_data_filepath, 'w') as json_file:
        json.dump(ima_data, json_file, indent=4)


if __name__ == "__main__":
    generate_ima_data_file(sys.argv[1])
