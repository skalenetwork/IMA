import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-typechain";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

function getCustomUrl(url: string | undefined) {
  if (url) {
    return url;
  } else {
    return "http://127.0.0.1:8545"
  }
}

function getCustomPrivateKey(privateKey: string | undefined) {
  if (privateKey) {
    return [privateKey];
  } else {
    return [];
  }
}

function getGasPrice(gasPrice: string | undefined) {
  if (gasPrice) {
    return parseInt(gasPrice, 10);
  } else {
    return "auto";
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    version: '0.8.6',
    settings: {
      optimizer:{
        enabled: true,
        runs: 200
      }
    }
  },
  mocha: {
    timeout: 1000000
  },
  networks: {
    hardhat: {
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true
    },
    custom: {
      url: getCustomUrl(process.env.ENDPOINT),
      accounts: getCustomPrivateKey(process.env.PRIVATE_KEY),
      gasPrice: getGasPrice(process.env.GASPRICE)
    },
    mainnet: {
      url: getCustomUrl(process.env.URL_W3_ETHEREUM),
      accounts: getCustomPrivateKey(process.env.PRIVATE_KEY_FOR_ETHEREUM),
      gasPrice: getGasPrice(process.env.GASPRICE)
    },
    schain: {
      url: getCustomUrl(process.env.URL_W3_S_CHAIN),
      accounts: getCustomPrivateKey(process.env.PRIVATE_KEY_FOR_SCHAIN),
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN
  }
};

export default config;
