from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_ERC20_ADDRESS, \
    TOKEN_MANAGER_ERC721_ADDRESS, TOKEN_MANAGER_ETH_ADDRESS, TOKEN_MANAGER_ERC1155_ADDRESS
from web3 import Web3
from ..contract_generator import ContractGenerator, next_slot


class TokenManagerLinkerGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "TokenManagerLinker.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    REGISTRAR_ROLE = Web3.solidityKeccak(['string'], ['REGISTRAR_ROLE'])

    # ---------- storage ----------
    # --------Initializable--------
    # 0:    _initialized, _initializing;
    # -----ContextUpgradeable------
    # 1:    __gap
    # ...   __gap
    # 50:   __gap
    # --AccessControlUpgradeable---
    # 51:   _roles
    # 52:   __gap
    # ...   __gap
    # 100:  __gap
    # ------TokenManagerLinker------
    # 101:  messageProxy
    # 102:  linkerAddress
    # 103:  tokenManagers
    # 104:  interchainConnections

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 51
    MESSAGE_PROXY_SLOT = 101
    LINKER_ADDRESS_SLOT = next_slot(MESSAGE_PROXY_SLOT)
    TOKEN_MANAGERS_SLOT = next_slot(LINKER_ADDRESS_SLOT)

    def __init__(self, deployer_address: str, linker_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address, linker_address)

    # private

    def _setup(self, deployer_address: str, linker_addres: str) -> None:
        self._write_uint256(self.INITIALIZED_SLOT, 1)
        self._setup_role(self.ROLES_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._setup_role(self.ROLES_SLOT, self.REGISTRAR_ROLE, [deployer_address])
        self._write_address(self.MESSAGE_PROXY_SLOT, MESSAGE_PROXY_FOR_SCHAIN_ADDRESS)
        self._write_address(self.LINKER_ADDRESS_SLOT, linker_addres)
        self._write_addresses_array(
            self.TOKEN_MANAGERS_SLOT, [
                TOKEN_MANAGER_ETH_ADDRESS,
                TOKEN_MANAGER_ERC20_ADDRESS,
                TOKEN_MANAGER_ERC721_ADDRESS,
                TOKEN_MANAGER_ERC1155_ADDRESS])
