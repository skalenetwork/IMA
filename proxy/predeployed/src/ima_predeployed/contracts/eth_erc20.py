from ima_predeployed.addresses import TOKEN_MANAGER_ETH_ADDRESS
from ima_predeployed.contract_generator import ContractGenerator, next_slot
from web3 import Web3


class EthErc20Generator(ContractGenerator):
    ARTIFACT_FILENAME = "EthErc20.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    MINTER_ROLE = Web3.solidityKeccak(['string'], ['MINTER_ROLE'])
    BURNER_ROLE = Web3.solidityKeccak(['string'], ['BURNER_ROLE'])
    NAME = 'ERC20 Ether Clone'
    SYMBOL = 'ETHC'
    DECIMALS = 18

    # ---------- storage ----------
    # --------Initializable--------
    # 0:    _initialized, _initializing;
    # -----ContextUpgradeable------
    # 1:    __gap
    # ...   __gap
    # 50:   __gap
    # ------ERC165Upgradeable------
    # 51:   __gap
    # ...   __gap
    # 100:  __gap
    # --AccessControlUpgradeable---
    # 101:  _roles
    # 102:  __gap
    # ...   __gap
    # 150:  __gap
    # AccessControlEnumerableUpgradeable
    # 151:  _roleMembers
    # 152:  __gap
    # ...   __gap
    # 200:  __gap
    # -------ERC20Upgradeable-------
    # 201:  _balances
    # 202:  _allowances
    # 203:  _totalSupply
    # 204:  _name
    # 205:  _symbol
    # 206:  _decimals
    # 207:  __gap
    # ...   __gap
    # 250:  __gap
    # ---ERC20BurnableUpgradeable---
    # 251:  __gap
    # ...   __gap
    # 300:  __gap
    # -----------EthErc20-----------

    INITIALIZED_SLOT = 0
    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    NAME_SLOT = 204
    SYMBOL_SLOT = next_slot(NAME_SLOT)
    DECIMALS_SLOT = next_slot(SYMBOL_SLOT)

    def __init__(self, deployer_address: str):
        super().__init__(self.ARTIFACT_FILENAME)
        self._setup(deployer_address)

    # private

    def _setup(self, deployer_address: str) -> None:
        self._write_uint256(self.INITIALIZED_SLOT, 1)
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.DEFAULT_ADMIN_ROLE, [deployer_address])
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.MINTER_ROLE, [TOKEN_MANAGER_ETH_ADDRESS])
        self._setup_role(self.ROLES_SLOT, self.ROLE_MEMBERS_SLOT, self.BURNER_ROLE, [TOKEN_MANAGER_ETH_ADDRESS])
        self._write_string(self.NAME_SLOT, self.NAME)
        self._write_string(self.SYMBOL_SLOT, self.SYMBOL)
        self._write_uint256(self.DECIMALS_SLOT, self.DECIMALS)
