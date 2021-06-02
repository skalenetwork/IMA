from ima_predeployed.addresses import KEY_STORAGE_ADDRESS
from ima_predeployed.contracts.key_storage import KeyStorageGenerator
from tools import load_abi, w3


def check_key_storage(owner_address):
    key_storage = w3.eth.contract(address=KEY_STORAGE_ADDRESS, abi=load_abi(KeyStorageGenerator.ARTIFACT_FILENAME))
    if not key_storage.functions.getRoleMember(KeyStorageGenerator.DEFAULT_ADMIN_ROLE, 0).call() == owner_address: raise AssertionError
    if not key_storage.functions.hasRole(KeyStorageGenerator.DEFAULT_ADMIN_ROLE, owner_address).call(): raise AssertionError
