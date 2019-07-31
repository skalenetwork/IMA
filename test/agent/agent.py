from utils import execute

class Agent:
    config = None

    def __init__(self, config):
        self.config = config

    def register(self):
        self._execute_command('register')

    # private

    def _execute_command(self, command):
        execute(f'node {self.config.agent_root}/main.js --verbose=9 \
            --{command} \
            --url-main-net={self.config.mainnet_rpc_url} \
            --url-s-chain={self.config.schain_rpc_url} \
            --id-main-net=Mainnet \
            --id-s-chain={self.config.schain_name} \
            --abi-main-net={self.config.proxy_root}/data/proxyMainnet.json \
            --abi-s-chain={self.config.proxy_root}/data/proxySchain_{self.config.schain_name}.json \
            --key-main-net={self.config.mainnet_key} \
            --key-s-chain={self.config.schain_key}')