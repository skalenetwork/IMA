const fs = require("fs");
const path = require("path");
const solc = require("solc");

//let MessageProxy = artifacts.require("./MessageProxy.sol");
//let DepositBox = artifacts.require("./DepositBox.sol");
//let TokenManager = artifacts.require("./TokenManager.sol");
let Ownable = path.resolve(__dirname, '../contracts', 'Ownable.sol');
let MessageProxy = path.resolve(__dirname, '../contracts', 'MessageProxy.sol');
let TokenManager = path.resolve(__dirname, '../contracts', 'TokenManager.sol');
let ERC20Manager = path.resolve(__dirname, '../contracts', 'ERC20Manager.sol');

const networkName = process.env.NETWORK;
const privateKey = process.env.ETH_PRIVATE_KEY;
const schainName = process.env.SCHAIN_NAME;

let networks = require("../truffle.js");
let proxyMainnet = require("../proxyMainnet.json");
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
    //console.log(result);
    console.log(`${contractName} deployed to: ${result.options.address}`);
    return {receipt: result, contract: contractObj, address: result.options.address, abi: JSON.parse(object.contracts[contractName].interface)};
}

async function deploy() {
    console.log('Attempting to deploy from account: ', account);

    let messageProxy = {
        'Ownable.sol': fs.readFileSync(Ownable, 'UTF-8'),
        'MessageProxy.sol': fs.readFileSync(MessageProxy, 'UTF-8')
    }
    let messageProxyResult1 = await deployContract("MessageProxy.sol:MessageProxy", {sources: messageProxy}, {gas: 8000000, 'account': account, 'arguments': [schainName]});
    /*let tokenManager = {
        'Ownable.sol': fs.readFileSync(Ownable, 'UTF-8'),
        'TokenManager.sol': fs.readFileSync(TokenManager, 'UTF-8')
    }
    let tokenManagerResult = await deployContract("TokenManager.sol:TokenManager", {sources: tokenManager}, {gas: 5000000, 'account': account, 'arguments': [schainName, proxyMainnet['deposit_box_address'], messageProxyResult1.address], 'value': web3beta.utils.toWei("100", "ether")});*/

    let erc20Manager = {
        'Ownable.sol': fs.readFileSync(Ownable, 'UTF-8'),
        'ERC20Manager.sol': fs.readFileSync(ERC20Manager, 'UTF-8')
    }
    let erc20ManagerResult = await deployContract("ERC20Manager.sol:ERC20Manager", {sources: erc20Manager}, {gas: 5000000, 'account': account, 'arguments': [schainName, messageProxyResult1.address]});

    let jsonObject = {
        //token_manager_address: tokenManagerResult.address,
        //token_manager_abi: tokenManagerResult.abi,
        erc20_manager_address: erc20ManagerResult.address,
        erc20_manager_abi: erc20ManagerResult.abi,
        message_proxy_chain_address: messageProxyResult1.address,
        message_proxy_chain_abi: messageProxyResult1.abi
    }

    fs.writeFile('proxySchain.json', JSON.stringify(jsonObject), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log(`Done, check proxySchain.json file in data folder.`);
        process.exit(0);
    });
}

deploy();
