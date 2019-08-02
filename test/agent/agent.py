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

    def _execute_command(self, command, flags={}):
        execute(self._format_command(command, flags))

    def _construct_command(self, command, flags={}):
        flags = {**self._get_default_flags(), command: None, **flags}

        return ['node',
                f'{self.config.agent_root}/main.js'] + \
               [f'--{key}' + (f'={str(value)}' if value is not None else '') for key, value in flags.items() ]

    def _format_command(self, command, flags={}):
        return ' '.join(self._construct_command(command, flags))

    def _get_default_flags(self):
        return {
            'verbose': 9,
            'url-main-net': self.config.mainnet_rpc_url,
            'url-s-chain': self.config.schain_rpc_url,
            'id-main-net': 'Mainnet',
            'id-s-chain': self.config.schain_name,
            'abi-main-net': self.config.abi_mainnet,
            'abi-s-chain': self.config.abi_schain,
            'key-main-net': self.config.mainnet_key,
            'key-s-chain': self.config.schain_key
        }