const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const SCHAIN_DIR = process.env.SCHAIN_DIR;

const LOCAL_WALLET_PATH = process.env.LOCAL_WALLET_PATH;
const MAINNET_PROXY_PATH = process.env.MAINNET_PROXY_PATH;
const SCHAIN_PROXY_PATH = process.env.SCHAIN_PROXY_PATH;
const SCHAIN_NAME = process.env.SCHAIN_ID;

const SCHAIN_RPC_URL = process.env.SCHAIN_RPC_URL;
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL;

const NODE_NUMBER = process.env.NODE_NUMBER;
const NODES_COUNT = process.env.NODES_COUNT;

let debugInfo = `LOCAL_WALLET_PATH: ${LOCAL_WALLET_PATH},
MAINNET_PROXY_PATH: ${MAINNET_PROXY_PATH},
SCHAIN_PROXY_PATH: ${SCHAIN_PROXY_PATH},
SCHAIN_DIR: ${SCHAIN_DIR},
SCHAIN_NAME: ${SCHAIN_NAME},
SCHAIN_RPC_URL: ${SCHAIN_RPC_URL},
MAINNET_RPC_URL: ${MAINNET_RPC_URL},

NODE_NUMBER: ${NODE_NUMBER},
NODES_COUNT: ${NODES_COUNT},

`;
console.log(debugInfo);

const CHECK_TIMEOUT = 4000;

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};

async function run() {
  console.log('Initing IMA...');
  let sChainAbiFileExists = false;

  while (!sChainAbiFileExists) {
    console.log(`Waiting for ${SCHAIN_PROXY_PATH} file...`);
    sChainAbiFileExists = fs.existsSync(SCHAIN_PROXY_PATH);

    if (sChainAbiFileExists) {
      console.log('File found!');

      let fileContents = await fs.promises.readFile(LOCAL_WALLET_PATH);
      let localWallet = JSON.parse(fileContents);
      let pk = localWallet['private_key'].slice(2);

      let baseArgs = `--url-main-net=${MAINNET_RPC_URL} --url-s-chain=${SCHAIN_RPC_URL} \
      --id-main-net=Mainnet --id-s-chain=${SCHAIN_NAME} --abi-main-net=${MAINNET_PROXY_PATH} \
      --node-number=${NODE_NUMBER} --nodes-count=${NODES_COUNT}  \
      --abi-s-chain=${SCHAIN_PROXY_PATH} --key-main-net=${pk} --key-s-chain=${pk}  `;

      let baseCmd = `node ${__dirname}/main.js`;
      let registerCmd = `${baseCmd} --register ${baseArgs}`;
      let loopCmd = `${baseCmd} --loop ${baseArgs}`;

      // console.log(registerCmd); // todo: rm, tmp!
      console.log(loopCmd); // todo: rm, tmp!

      // child_process.execSync(
      //   registerCmd,
      //   {stdio: 'inherit'}
      // );

      child_process.execSync(
        loopCmd,
        {stdio: 'inherit'}
      );


      // todo: start IMA logic!!!
    }

    await sleep(CHECK_TIMEOUT);
  }
}

run();


