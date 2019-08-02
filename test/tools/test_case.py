from tools.blockchain import BlockChain
from proxy.deployer import Deployer
from agent.agent import Agent
from time import time

class TestCase:
    name = None
    deployer = None
    agent = None
    passed = False
    blockchain = None
    config = None
    time_started = time()
    timeout = None

    def __init__(self, name, config, timeout=60):
        self.name = name
        self.deployer = Deployer(config)
        self.agent = Agent(config)
        self.blockchain = BlockChain(config)
        self.config = config
        self.timeout = timeout


    def prepare(self):
        self.deployer.deploy()
        self.agent.register()
        self.agent.start()
        self._prepare()

    def execute(self):
        self.time_started = time()
        self._execute()
        if self._timeout():
            self.passed = False

    def clean_up(self):
        self._clean_up()

    def is_passed(self):
        return self.passed

    def get_name(self):
        return self.name

    # protected

    def _prepare(self):
        pass

    def _execute(self):
        pass

    def _clean_up(self):
        pass

    def _mark_passed(self):
        self.passed = True

    def _timeout(self):
        if self.timeout is not None and time() > self.time_started + self.timeout:
            return True
        else:
            return False
