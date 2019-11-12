from tools.utils import execute
from os import chdir

class Deployer:
    def __init__(self, config):
        self.config = config

    def deploy(self):
        chdir(self.config.proxy_root)
        self._prepare_env_file()
        execute('bash ./scripts/prepareSkaleManagerComponents.sh')
        execute('yarn deploy-to-both-chains')

    def deploy_mainnet(self):
        chdir(self.config.proxy_root)
        self._prepare_env_file()
        execute('bash ./scripts/prepareSkaleManagerComponents.sh')
        execute('yarn deploy-to-mainnet')

    def deploy_schain(self):
        chdir(self.config.proxy_root)
        self._prepare_env_file()
        execute('yarn deploy-to-schain')

    # private

    def _prepare_env_file(self):
        env_file = [f'NETWORK_FOR_MAINNET="{self.config.network_for_mainnet}"',
                    f'NETWORK_FOR_SCHAIN="{self.config.network_for_schain}"',
                    f'MNEMONIC_FOR_MAINNET="{self.config.mainnet_key}"',
                    f'MAINNET_RPC_URL="{self.config.mainnet_rpc_url}"',
                    f'MNEMONIC_FOR_SCHAIN="{self.config.schain_key}"',
                    f'SCHAIN_RPC_URL="{self.config.schain_rpc_url}"',
                    f'SCHAIN_NAME="{self.config.schain_name}"']

        with open('.env', 'w') as dot_env:
            dot_env.write('\n'.join(env_file))

