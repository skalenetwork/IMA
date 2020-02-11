usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("solidity-coverage");
require('dotenv').config();

module.exports = {
  defaultNetwork: "buidlerevm",
  solc: {
    version: '0.5.15',
    evmVersion: 'petersburg',
    optimizer:{
      enabled: true,
      runs: 200
    }
  },
  mocha: {
    timeout: 300000
  },
  networks: {
    buidlerevm: {
      gas: 10000000,
      blockGasLimit: 0xfffffffffff,
      port: 8555
    }
  }
};
