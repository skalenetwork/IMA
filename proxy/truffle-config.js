require('dotenv').config();
const Web3 = require('web3');
let hdwalletProvider = require('truffle-hdwallet-provider');
let privateKeyProvider = require('truffle-privatekey-provider');
let schainName = process.env.SCHAIN_NAME;
let schainRpcUrl = process.env.SCHAIN_RPC_URL;
let mainnetRpcUrl = process.env.MAINNET_RPC_URL;

let privateKeyForMainnet = process.env.PRIVATE_KEY_FOR_MAINNET;
let privateKeyForSchain = process.env.PRIVATE_KEY_FOR_SCHAIN;


// var PrivateKeyProvider = require("truffle-privatekey-provider");
const HDWalletProvider = require("truffle-hdwallet-provider");
//const Web3 = require("web3");

var privateKey_main_net = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
var privateKey_s_chain  = "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e";




let schainRpcIp = process.env.SCHAIN_RPC_IP;
let schainRpcPort = process.env.SCHAIN_RPC_PORT;

/*

export NETWORK_FOR_MAINNET="local"
export ETH_PRIVATE_KEY_FOR_MAINNET="23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc"
export NETWORK_FOR_SCHAIN="serge"
export ETH_PRIVATE_KEY_FOR_SCHAIN="80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e"
export SCHAIN_NAME="Bob"

*/


module.exports = {
    /**
     * Networks define how you connect to your ethereum client and let you set the
     * defaults web3 uses to send transactions. If you don't specify one truffle
     * will spin up a development blockchain for you on port 9545 when you
     * run `develop` or `test`. You can ask a truffle command to use a specific
     * network from the command line, e.g
     *
     * $ truffle test --network <network-name>
     */

    networks: {
      /*
      mainnet: {
        provider: () => {
          return new privateKeyProvider(privateKeyForMainnet, mainnetRpcUrl);
        },
        gasPrice: 1000000000,
        gas: 8000000,
        network_id: "*"
      },
      */
      local: {
        gasPrice: 10000000000,
        gas: 8000000,
        network_id: "*",
        // from: "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f",
        // provider: () => { return new PrivateKeyProvider( privateKey_main_net, "http://127.0.0.1:8545" ); },
        provider: () => { return new HDWalletProvider( privateKey_main_net, "http://127.0.0.1:8545" ); },
        skipDryRun: true
      },
      /*
      pseudo_mainnet: {
        gasPrice: 10000000000,
        host: "127.0.0.1",
        port: 8545,
        gas: 8000000,
        network_id: "*"
      },
      // */
      /*
      mainnet: {
        provider: () => {
          return new hdwalletProvider(privateKeyForMainnet, mainnetRpcUrl);
        },
        gasPrice: 1000000000,
        gas: 8000000,
        network_id: "*"
      },
      */

      schain: {
        provider: () => {
          return new privateKeyProvider(privateKeyForSchain, schainRpcUrl);
        },
        gasPrice: 1000000000,
        gas: 8000000,
        name: schainName,
        network_id: "*"
      },
      schain: {
        name: "Bob",
        gasPrice: 10000000000,
        gas: 8000000,
        // from: "0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852",
        network_id: "*",
        // provider: () => { return new PrivateKeyProvider( privateKey_s_chain, "http://127.0.0.1:7000" ); },
        provider: () => { return new HDWalletProvider( privateKey_s_chain, "http://127.0.0.1:7000" ); },
        skipDryRun: true
      }

      // Another network with more advanced options...
      // advanced: {
        // port: 8777,             // Custom port
        // network_id: 1342,       // Custom network
        // gas: 8500000,           // Gas sent with each transaction (default: ~6700000)
        // gasPrice: 20000000000,  // 20 gwei (in wei) (default: 100 gwei)
        // from: <address>,        // Account to send txs from (default: accounts[0])
        // websockets: true        // Enable EventEmitter interface for web3 (default: false)
      // },

      // Useful for deploying to a public network.
      // NB: It's important to wrap the provider as a function.
      // ropsten: {
        // provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/${infuraKey}`),
        // network_id: 3,       // Ropsten's id
        // gas: 5500000,        // Ropsten has a lower block limit than mainnet
        // confirmations: 2,    // # of confs to wait between deployments. (default: 0)
        // timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
        // skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
      // },

      // Useful for private networks
      // private: {
        // provider: () => new HDWalletProvider(mnemonic, `https://network.io`),
        // network_id: 2111,   // This network is yours, in the cloud.
        // production: true    // Treats this network as if it was a public net. (default: false)
      // }
    },

    // Set default mocha options here, use special reporters etc.
    mocha: {
      // timeout: 100000
    },

    // Configure your compilers
    compilers: {
      solc: {
        version: "0.5.7",
      }
    }
  }
