from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator

from .token_manager import TokenManagerGenerator


class TokenManagerErc721WithMetadataGenerator(TokenManagerGenerator):
    ARTIFACT_FILENAME = "TokenManagerERC721WithMetadata.json"
    META_FILENAME = "TokenManagerERC721WithMetadata.meta.json"

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
    # ------TokenManagerERC721------
    # 207:  clonesErc721
    # ------TokenManagerERC721WithMetadata------

    def __init__(self):
        super().__init__()


class UpgradeableTokenManagerErc721WithMetadataGenerator(UpgradeableContractGenerator):
    """Generates upgradeable instance of TokenManagerErc721WithMetadataUpgradeable
    """

    def __init__(self):
        super().__init__(implementation_generator=TokenManagerErc721WithMetadataGenerator())
