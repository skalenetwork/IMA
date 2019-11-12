require('dotenv').config();
require("ts-node/register");
const Web3 = require('web3');
let hdwalletProvider = require('truffle-hdwallet-provider');
let schainName = process.env.SCHAIN_NAME;
let schainRpcUrl = process.env.SCHAIN_RPC_URL;
let mainnetRpcUrl = process.env.MAINNET_RPC_URL;

let privateKeyForMainnet = process.env.PRIVATE_KEY_FOR_MAINNET;
let privateKeyForSchain = process.env.PRIVATE_KEY_FOR_SCHAIN;

let mnemonicForMainnet = process.env.MNEMONIC_FOR_MAINNET;
let mnemonicForSchain = process.env.MNEMONIC_FOR_SCHAIN;

let accountForMainnet = process.env.ACCOUNT_FOR_MAINNET;
let accountForSchain = process.env.ACCOUNT_FOR_SCHAIN;

module.exports = {
    test_file_extension_regexp: /.*\.ts$/,

    networks: {
      /*
      network-sample-1: {
        provider: () => {
          return new hdwalletProvider(privateKeyForMainnet, mainnetRpcUrl);
        },
        gasPrice: 1000000000,
        gas: 8000000,
        network_id: "*"
      },
      network-sample-2: {
        provider: () => {
          return new hdwalletProvider(mnemonicForMainnet, mainnetRpcUrl);
        },
        gasPrice: 1000000000,
        gas: 8000000,
        network_id: "*"
      },
      network-sample-3: {
        provider: () => {
          return new Web3.providers.HttpProvider(mainnetRpcUrl);
        },
        gasPrice: 1000000000,
        gas: 8000000,
        from: accountForMainnet,
        network_id: "*"
      },
      schain-network-sample: {
        provider: () => {
          return new hdwalletProvider(privateKeyForSchain, schainRpcUrl);
        },
        gasPrice: 0,
        gas: 8000000,
        name: schainName,
        network_id: "*"
      },
      */
      schain: {
        gasPrice: 0,
        provider: () => {
          return new hdwalletProvider(mnemonicForSchain, schainRpcUrl);
        },
        gas: 8000000,
        network_id: "*",
        name: schainName,
        skipDryRun: true
      },
      coverage: {
        name: "test",
        host: "127.0.0.1",
        port: "8555",
        gas: 0xfffffffffff,
        gasPrice: 0x01,
        network_id: "*"
      },
      test: {
        name: "test",
        host: "127.0.0.1",
        port: 8545,
        gas: 8000000,
        network_id: "*"
      },
      mainnet: {
        provider: () => {
          return new hdwalletProvider(mnemonicForMainnet, mainnetRpcUrl);
        },
        gasPrice: 10000000000,
        gas: 8000000,
        network_id: "*",
        skipDryRun: true // added experimentally
      }
    },
    mocha: {
      // timeout: 100000
    },
    // compilers: { // this is for ganache tests
    //   solc: {
    //     version: "0.5.10",
    //     settings: {
    //       optimizer: {
    //         enabled: true,
    //         runs: 200
    //       },
    //       evmVersion: "petersburg"
    //     }
    //   }
    // }
    compilers: {
      solc: {
        version: "0.5.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "byzantium"
        }
      }
    }
  }
