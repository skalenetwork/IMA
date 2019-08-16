from os import chdir
from tools.environment import Environment
from tools.utils import execute

class ProxyEnvironment(Environment):
    config = None

    def __init__(self, config):
        self.config = config

    def prepare(self):
        chdir(self.config.proxy_root)
        execute('yarn install')
