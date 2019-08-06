class Config:
    agent_root = 'agent'
    skale_ima_root = 'npms/skale-mta'
    proxy_root = 'proxy'
    network_for_mainnet = 'mainnet'
    network_for_schain = 'schain'
    mainnet_key=''
    mainnet_rpc_url='http://localhost:8545'
    schain_key = ''
    schain_rpc_url = 'http://localhost:8545'
    schain_name = 'd2'
    abi_mainnet = 'data/proxyMainnet.json'
    abi_schain = 'data/proxySchain_'
    user_key = ''

    def __init__(self, src_root, config_json):
        self.proxy_root = src_root + '/' + self.proxy_root
        self.agent_root = src_root + '/' + self.agent_root
        self.skale_ima_root = src_root + '/' + self.skale_ima_root

        self.network_for_mainnet = config_json['NETWORK_FOR_MAINNET']
        self.network_for_schain = config_json['NETWORK_FOR_SCHAIN']
        self.mainnet_key = config_json['ETH_PRIVATE_KEY_FOR_MAINNET']
        self.mainnet_rpc_url = config_json['MAINNET_RPC_URL']
        self.schain_key = config_json['ETH_PRIVATE_KEY_FOR_SCHAIN']
        self.schain_rpc_url = config_json['SCHAIN_RPC_URL']
        self.schain_name = config_json['SCHAIN_NAME']
        self.user_key = config_json['user_key']

        self.abi_mainnet = self.proxy_root + '/' + self.abi_mainnet
        self.abi_schain = self.proxy_root + '/' + self.abi_schain + self.schain_name + '.json'


