from environment import Environment
from os import chdir
from utils import execute

class AgentEnvironment(Environment):
    config = None

    def __init__(self, config):
        self.config = config

    def prepare(self):
        chdir(self.config.skale_ima_root)
        execute('rm -r node_modules')
        execute('npm install')

        chdir(self.config.agent_root)
        execute('rm -r node_modules')
        execute('npm install')