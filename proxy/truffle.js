/*
 * NB: since truffle-hdwallet-provider 0.0.5 you must wrap HDWallet providers in a 
 * function when declaring them. Failure to do so will cause commands to hang. ex:
 * ```
 * mainnet: {
 *     provider: function() { 
 *       return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/<infura-key>') 
 *     },
 *     network_id: '1',
 *     gas: 4500000,
 *     gasPrice: 10000000000,
 *   },
 */

module.exports = {
  networks: {
    server: {
      host: "51.0.1.99",
      port: 8545,
      gasPrice: 10000000000,
      network_id: "*"
    },
    local: {
      gasPrice: 10000000000,
      host: "127.0.0.1",
      port: 2231,
      gas: 8000000,
      network_id: "*",
      "from": "0x6196d135CdDb9d73A0756C1E44b5b02B11acf594"
    },
    pseudo_main_net: {
      gasPrice: 10000000000,
      host: "127.0.0.1",
      port: 8545,
      gas: 8000000,
      network_id: "*",
      "from": "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
    },
    aws: {
      host: "13.59.228.21",
      port: 1919,
      gasPrice: 10000000000,
      network_id: "*",
    },
    serge: {
      host: "0.0.0.0",
      port: 2231,
      gasPrice: 10000000000,
      gas: 8000000,
      from: "0x6196d135CdDb9d73A0756C1E44b5b02B11acf594",
      network_id: "*"
    },
    schain: {
      host: "159.89.130.2",
      port: 8003,
      gasPrice: 10000000000,
      gas: 8000000,
      from: "0x5112ce768917e907191557d7e9521c2590cdd3a0",
      network_id: "*"
    }
  }
};
