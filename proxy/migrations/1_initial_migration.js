let fs = require("fs");

let MessageProxy = artifacts.require("./MessageProxy.sol");
let DepositBox = artifacts.require("./DepositBox.sol");
let TokenManager = artifacts.require("./TokenManager.sol");

const networkName = process.env.NETWORK;
const privateKey = process.env.ETH_PRIVATE_KEY;

let networks = require("../truffle.js");
let currentNetwork = networks['networks'][networkName];

let schainName = process.env.SCHAIN_NAME;

const LINE = '======================================';

const Web3 = require('web3');
const PrivateKeyProvider = require("truffle-privatekey-provider");
const provider = new PrivateKeyProvider(privateKey, `http://${currentNetwork['host']}:${currentNetwork['port']}`);
const web3beta = new Web3(provider);

const account = web3beta['_provider']['address'];

async function deployContract(contract, options) {
    let contractName = contract['_json']['contractName'];
    console.log(LINE);
    console.log(`Deploying: ${contractName}, options: ${JSON.stringify(options)}`);
    const contractObj = new web3beta.eth.Contract(contract['_json']['abi']);
    const result = await contractObj.deploy({data: contract['_json']['bytecode'], arguments: options['arguments']})
        .send({gas: options['gas'], from: options['account'], value: options['value']});
    //console.log(result);
    console.log(`${contractName} deployed to: ${result.options.address}`);
    return {receipt: result, contract: contractObj, address: result.options.address};
}

async function deploy(deployer) {
    console.log('Attempting to deploy from account: ', account);

    let messageProxyResult0 = await deployContract(MessageProxy, {gas: 8000000, 'account': account, 'arguments': ["Mainnet"]});
    let messageProxyResult1 = await deployContract(MessageProxy, {gas: 8000000, 'account': account, 'arguments': ["Artem's Schain"]});
    let depositBoxResult = await deployContract(DepositBox, {gas: 8000000, 'account': account, 'arguments': [messageProxyResult0.address]});
    //let tokenManagerResult = await deployContract(TokenManager, {gas: 5000000, 'account': account, 'arguments': ["Artem's Schain", depositBoxResult.address, messageProxyResult1.address], 'value': web3.toWei(102000000, "ether")});
    let tokenManagerResult = await deployContract(TokenManager, {gas: 8000000, 'account': account, 'arguments': ["Artem's Schain", depositBoxResult.address, messageProxyResult1.address], 'value': web3.toWei(100, "ether")});

    let jsonObject = {
        deposit_box_address: depositBoxResult.address,
        deposit_box_abi: DepositBox.abi,
        token_manager_address: tokenManagerResult.address,
        token_manager_abi: TokenManager.abi,
        message_proxy_mainnet_address: messageProxyResult0.address,
        message_proxy_mainnet_abi: MessageProxy.abi,
        message_proxy_chain_address: messageProxyResult1.address,
        message_proxy_chain_abi: MessageProxy.abi
    }

    let filename = schainName ? `${networkName}_${schainName}_proxy.json` : `${networkName}_proxy.json`;

    fs.writeFile(`data/${filename}`, JSON.stringify(jsonObject), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log(`Done, check ${filename} file in data folder.`);
        process.exit(0);
    });
}

module.exports = deploy;
