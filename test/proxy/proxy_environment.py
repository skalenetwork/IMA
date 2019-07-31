from os import system, chdir
from environment import Environment
from utils import execute

class ProxyEnvironment(Environment):
    config = None

    def __init__(self, config):
        self.config = config

    def prepare(self):
        chdir(self.config.proxy_root)
        execute('yarn install')
