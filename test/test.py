import sys
import os
import time

from config import Config
from agent.agent_environment import AgentEnvironment
from proxy.deployer import Deployer
from proxy.proxy_environment import ProxyEnvironment
from agent.agent import Agent

def main():
    if len(sys.argv) < 2:
        src_root = os.path.abspath(os.pardir)
    else:
        src_root = sys.argv[1]

    config = Config(src_root, 'config.json')

    # proxyEnvironment = ProxyEnvironment(config)
    # proxyEnvironment.prepare()
    #
    # agentEnvironment = AgentEnvironment(config)
    # agentEnvironment.prepare()

    deployer = Deployer(config)
    deployer.deploy()

    agent = Agent(config)
    agent.register()

    agent.start()

    time.sleep(10)


if __name__ == '__main__':
    main()
