from ima_predeployed.addresses import ETH_ERC20_ADDRESS
from ima_predeployed.contract_generator import next_slot
from ima_predeployed.contracts.token_manager import TokenManagerGenerator


class TokenManagerEthGenerator(TokenManagerGenerator):
    ARTIFACT_FILENAME = "TokenManagerEth.json"

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
    # ---------TokenManager---------
    # 201:  messageProxy
    # 202:  tokenManagerLinker
    # 203:  communityLocker
    # 204:  schainHash
    # 205:  depositBox, automaticDeploy
    # 206:  tokenManagers
    # -------TokenManagerEth-------
    # 207:  ethErc20

    ETH_ERC_20_SLOT = next_slot(TokenManagerGenerator.TOKEN_MANAGERS_SLOT)

    def __init__(self, deployer_address: str, deposit_box_address: str, schain_name: str):
        super().__init__(deployer_address, deposit_box_address, schain_name)
        self._setup()

    # private

    def _setup(self) -> None:
        self._write_address(self.ETH_ERC_20_SLOT, ETH_ERC20_ADDRESS)
