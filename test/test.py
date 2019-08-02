import sys
import os

from tools.config import Config
from proxy.deployer import Deployer
from agent.agent import Agent
from test_cases.send_ether_to_schain import SendEtherToSchain
from tools.config_generator import config_generator


def main():
    if len(sys.argv) < 2:
        src_root = os.path.abspath(os.pardir)
    else:
        src_root = sys.argv[1]

    for config in config_generator(src_root, 'config.json'):

        # proxyEnvironment = ProxyEnvironment(config)
        # proxyEnvironment.prepare()
        #
        # agentEnvironment = AgentEnvironment(config)
        # agentEnvironment.prepare()

        deployer = Deployer(config)
        # deployer.deploy()

        agent = Agent(config)
        # agent.register()

        # agent.start()

        # time.sleep(10)

        test = SendEtherToSchain(config)
        test.prepare()
        test.execute()
        test.clean_up()

        if test.is_passed():
            print('Test passed')
        else:
            print('Test failed')

        # blockchain = BlockChain(config)
        # print(blockchain.key_to_address(config.schain_key))
        # blockchain.get_balance_on_schain(blockchain.key_to_address(config.schain_key))


if __name__ == '__main__':
    main()
