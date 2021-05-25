from ima_predeployed.addresses import MESSAGE_PROXY_FOR_SCHAIN_ADDRESS, TOKEN_MANAGER_LINKER_ADDRESS, \
    COMMUNITY_LOCKER_ADDRESS, ETH_ERC_20_ADDRESS
from ima_predeployed.contract_generator import next_slot
from ima_predeployed.contracts.token_manager import TokenManagerGenerator
from tools import w3


class TokenManagerEthGenerator(TokenManagerGenerator):
    ARTIFACT_FILENAME = "TokenManagerEth.json"
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')

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
    # 105:  depositBox
    # 106:  automaticDeploy
    # 107:  tokenManagers
    # -------TokenManagerEth-------
    # 108:  ethErc20

    ETH_ERC_20_SLOT = next_slot(TokenManagerGenerator.TOKEN_MANAGERS_SLOT)

    def __init__(self, deployer_address: str, deposit_box_address: str, schain_name: str):
        super().__init__(deployer_address, deposit_box_address, schain_name)
        self._setup()

    # private

    def _setup(self) -> None:
        self._write_address(self.ETH_ERC_20_SLOT, ETH_ERC_20_ADDRESS)
