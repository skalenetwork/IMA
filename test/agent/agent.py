from utils import execute
from subprocess import Popen

class Agent:
    config = None
    started = False
    agent_service = None

    def __init__(self, config):
        self.config = config

    def register(self):
        self._execute_command('register')

    def start(self):
        if self.agent_service is None:
            self.agent_service = Popen(self._construct_command('loop'))
            print(f'Agent process #{self.agent_service.pid}')

    def stop(self):
        if self.agent_service is not None:
            self.agent_service.terminate()
            self.agent_service = None


    # private

    def _execute_command(self, command):
        execute(self._format_command(command))

    def _construct_command(self, command):
        return ['node',
                f'{self.config.agent_root}/main.js',
                '--verbose=9',
                f'--{command}',
                f'--url-main-net={self.config.mainnet_rpc_url}',
                f'--url-s-chain={self.config.schain_rpc_url}',
                f'--id-main-net=Mainnet',
                f'--id-s-chain={self.config.schain_name}',
                f'--abi-main-net={self.config.proxy_root}/data/proxyMainnet.json',
                f'--abi-s-chain={self.config.proxy_root}/data/proxySchain_{self.config.schain_name}.json',
                f'--key-main-net={self.config.mainnet_key}',
                f'--key-s-chain={self.config.schain_key}']

    def _format_command(self, command):
        return ' '.join(self._construct_command(command))