from typing import Dict

from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from ..addresses import ETH_ERC20_ADDRESS
from .token_manager import TokenManagerGenerator


class TokenManagerEthGenerator(TokenManagerGenerator):
    ARTIFACT_FILENAME = "TokenManagerEth.json"
    META_FILENAME = "TokenManagerEth.meta.json"

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

    ETH_ERC_20_SLOT = TokenManagerGenerator.next_slot(TokenManagerGenerator.TOKEN_MANAGERS_SLOT)

    def __init__(self):
        super().__init__()

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        storage = super().generate_storage(**kwargs)
        cls._write_address(storage, cls.ETH_ERC_20_SLOT, ETH_ERC20_ADDRESS)
        return storage


class UpgradeableTokenManagerEthGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of TokenManagerEthUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=TokenManagerEthGenerator())
