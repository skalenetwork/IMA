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
    # --AccessControlUpgradeable---
    # 51:   _roles
    # 52:   __gap
    # ...   __gap
    # 100:  __gap
    # ---------TokenManager---------
    # 101:  messageProxy
    # 102:  tokenManagerLinker
    # 103:  communityLocker
    # 104:  schainHash
    # 105:  depositBox, automaticDeploy
    # 106:  tokenManagers
    # -------TokenManagerEth-------
    # 107:  ethErc20

    ETH_ERC_20_SLOT = next_slot(TokenManagerGenerator.TOKEN_MANAGERS_SLOT)

    def __init__(self, deployer_address: str, deposit_box_address: str, schain_name: str):
        super().__init__(deployer_address, deposit_box_address, schain_name)
        self._setup()

    # private

    def _setup(self) -> None:
        self._write_address(self.ETH_ERC_20_SLOT, ETH_ERC20_ADDRESS)
