import sys
import os

from config import Config
from agent.agent_environment import AgentEnvironment
from proxy.deployer import Deployer
from proxy.proxy_environment import ProxyEnvironment

def main():
    if len(sys.argv) < 2:
        src_root = os.pardir
    else:
        src_root = sys.argv[1]

    config = Config(src_root, 'config.json')
    agentEnvironment = AgentEnvironment()
    proxyEnvironment = ProxyEnvironment(config)
    # proxyEnvironment.prepare()

    deployer = Deployer(config)
    # deployer.deploy_mainnet()
    # deployer.deploy_schain()
    deployer.deploy()


if __name__ == '__main__':
    main()
