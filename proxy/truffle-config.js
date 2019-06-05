require('dotenv').config();
const Web3 = require('web3');
let hdwalletProvider = require('truffle-hdwallet-provider');
let privateKeyProvider = require('truffle-privatekey-provider');
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
      /*
      mainnet: {
        provider: () => { 
          return new Web3.providers.HttpProvider(mainnetRpcUrl); 
        },
        gasPrice: 1000000000,
        gas: 8000000,
        from: accountForMainnet,
        network_id: "*"
      }, 
      */
      // /*
      mainnet: {
        provider: () => { 
          return new hdwalletProvider(mnemonicForMainnet, mainnetRpcUrl); 
        },
        gasPrice: 1000000000,
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
      /*
      schain: {
        provider: () => { 
          return new privateKeyProvider(privateKeyForSchain, schainRpcUrl); 
        },
        gasPrice: 1000000000,
        gas: 8000000,
        name: schainName,
        network_id: "*"
      },
      */
      /*
      schain: {
        provider: () => { 
          return new Web3.providers.HttpProvider(schainRpcUrl); 
        },
        gasPrice: 1000000000,
        gas: 8000000,
        from: accountForSchain,
        name: schainName,
        network_id: "*"
      },
      */
      // /*
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
      // */
      /*
      schain: {
        gasPrice: 0,
        provider: () => { 
          return new hdwalletProvider(privateKeyForSchain, schainRpcUrl); 
        },
        gas: 8000000,
        network_id: "*",
        name: schainName,
        skipDryRun: true
      }
      */
    },
    mocha: {
      // timeout: 100000
    },
    compilers: {
      solc: {
        version: "0.5.9",
      }
    }
  }
  