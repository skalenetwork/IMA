from os.path import normpath, join, dirname
from predeployed_generator.tools import ArtifactsHandler

pkg_name = 'ima_predeployed'
package_artifacts_path = normpath(join(dirname(__file__), f'../src/{pkg_name}/artifacts'))
hardhat_contracts_path = normpath(join(dirname(__file__), '../../artifacts/contracts/schain'))


def prepare():
    handler = ArtifactsHandler(hardhat_contracts_path, package_artifacts_path)
    handler.prepare_artifacts('KeyStorage')
    handler.prepare_artifacts('MessageProxyForSchain')
    handler.prepare_artifacts('TokenManager')
    handler.prepare_artifacts('TokenManagerLinker')
    handler.prepare_artifacts('CommunityLocker')

    tms_hardhat_path = join(hardhat_contracts_path, 'TokenManagers')
    tms_handler = ArtifactsHandler(tms_hardhat_path, package_artifacts_path)
    tms_handler.prepare_artifacts('TokenManagerERC20')
    tms_handler.prepare_artifacts('TokenManagerERC721')
    tms_handler.prepare_artifacts('TokenManagerERC721WithMetadata')
    tms_handler.prepare_artifacts('TokenManagerERC1155')
    tms_handler.prepare_artifacts('TokenManagerEth')

    tokens_hardhat_path = join(hardhat_contracts_path, 'tokens')
    tokens_handler = ArtifactsHandler(tokens_hardhat_path, package_artifacts_path)
    tokens_handler.prepare_artifacts('EthErc20')
    tokens_handler.prepare_artifacts('ERC20OnChain')
    tokens_handler.prepare_artifacts('ERC721OnChain')
    tokens_handler.prepare_artifacts('ERC1155OnChain')


if __name__ == '__main__':
    prepare()