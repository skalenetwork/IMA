from tools.environment import Environment
from os import chdir
from tools.utils import execute

class AgentEnvironment(Environment):
    config = None

    def __init__(self, config):
        self.config = config

    def prepare(self):
        chdir(self.config.skale_ima_root)
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root + '/proxy')
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root + '/npms/skale-owasp')
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root + '/npms/skale-ima')
        execute('rm -rf node_modules')
        execute('yarn install')

        chdir(self.config.agent_root)
        execute('rm -rf node_modules')
        execute('yarn install')