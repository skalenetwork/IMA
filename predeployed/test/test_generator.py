from ima_predeployed.generator import generate_meta
from ima_predeployed.addresses import (
    MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS,
    MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_ERC1155_ADDRESS,
    TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS
)


def check_meta_generator():
    meta = generate_meta()
    assert meta[MESSAGE_PROXY_FOR_SCHAIN_IMPLEMENTATION_ADDRESS]['name'] == 'MessageProxyForSchain'
    assert meta[MESSAGE_PROXY_FOR_SCHAIN_ADDRESS]['name'] == 'TransparentUpgradeableProxy'
    assert meta[TOKEN_MANAGER_ERC1155_IMPLEMENTATION_ADDRESS]['name'] == 'TokenManagerERC1155'
    assert meta[TOKEN_MANAGER_ERC1155_ADDRESS]['name'] == 'TransparentUpgradeableProxy'
