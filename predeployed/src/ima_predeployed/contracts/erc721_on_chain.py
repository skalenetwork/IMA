from os.path import join, dirname
from predeployed_generator.contract_generator import (
    ContractGenerator
)


class Erc721OnChainGenerator(ContractGenerator):
    ARTIFACT_FILENAME = "ERC721OnChain.json"
    META_FILENAME = "ERC721OnChain.meta.json"

    def __init__(self):
        generator = Erc721OnChainGenerator.from_hardhat_artifact(
            join(dirname(__file__), '..', 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), '..', 'artifacts', self.META_FILENAME))
        super().__init__(bytecode=generator.bytecode, abi=generator.abi, meta=generator.meta)
