const fs = require("fs");
const path = require("path");
const solc = require("solc");
require('dotenv').config();

//let MessageProxy = artifacts.require("./MessageProxy.sol");
//let DepositBox = artifacts.require("./DepositBox.sol");
//let TokenManager = artifacts.require("./TokenManager.sol");
let Ownable = path.resolve(__dirname, '../contracts', 'Ownable.sol');
let MessageProxy = path.resolve(__dirname, '../contracts', 'MessageProxy.sol');
let DepositBox = path.resolve(__dirname, '../contracts', 'DepositBox.sol');

const networkName = process.env.NETWORK_FOR_MAINNET;
const privateKey = process.env.ETH_PRIVATE_KEY_FOR_MAINNET;

let networks = require("../truffle.js");
let currentNetwork = networks['networks'][networkName];

const LINE = '======================================';

const Web3 = require('web3');
const PrivateKeyProvider = require("truffle-privatekey-provider");
const provider = new PrivateKeyProvider(privateKey, `http://${currentNetwork['host']}:${currentNetwork['port']}`);
const web3beta = new Web3(provider);

const account = web3beta['_provider']['address'];

async function deployContract(contractName, contract, options) {
    let object = solc.compile(contract, 1);
    console.log(LINE);
    console.log(`Deploying: ${contractName}, options: ${JSON.stringify(options)}`);
    const contractObj = new web3beta.eth.Contract(JSON.parse(object.contracts[contractName].interface));
    
    const result = await contractObj.deploy({data: '0x' + object.contracts[contractName].bytecode, arguments: options['arguments']})
        .send({gas: options['gas'], from: options['account'], value: options['value']});
    
    console.log(`${contractName} deployed to: ${result.options.address}`);
    return {receipt: result, contract: contractObj, address: result.options.address, abi: JSON.parse(object.contracts[contractName].interface)};
}

async function deploy() {
    console.log('Attempting to deploy from account: ', account);

    let messageProxy = {
        'Ownable.sol': fs.readFileSync(Ownable, 'UTF-8'),
        'MessageProxy.sol': fs.readFileSync(MessageProxy, 'UTF-8')
    }
    let messageProxyResult0 = await deployContract("MessageProxy.sol:MessageProxy", {sources: messageProxy}, {gas: 8000000, 'account': account, 'arguments': ["Mainnet"]});
    let depositBox = {
        'Ownable.sol': fs.readFileSync(Ownable, 'UTF-8'),
        'DepositBox.sol': fs.readFileSync(DepositBox, 'UTF-8')
    }
    let depositBoxResult = await deployContract("DepositBox.sol:DepositBox", {sources: depositBox}, {gas: 8000000, 'account': account, 'arguments': [messageProxyResult0.address]});

    let jsonObject = {
        //deposit_box_address: depositBoxResult.address,
        //deposit_box_abi: DepositBox.abi,
        deposit_box_address: depositBoxResult.address,
        deposit_box_abi: depositBoxResult.abi,
        message_proxy_mainnet_address: messageProxyResult0.address,
        message_proxy_mainnet_abi: messageProxyResult0.abi
    }

    fs.writeFile('proxyMainnet.json', JSON.stringify(jsonObject), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log(`Done, check proxyMainnet.json file in data folder.`);
        process.exit(0);
    });
}

deploy();