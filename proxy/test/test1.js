const networkName = process.env.NETWORK;
const privateKey =  process.env.ETH_PRIVATE_KEY;

let networks = require("../truffle.js");
let currentNetwork = networks['networks'][networkName];

const LINE = '======================================';

const Web3 = require('web3');
const PrivateKeyProvider = require("truffle-privatekey-provider");
const provider = new PrivateKeyProvider(privateKey, `http://${currentNetwork['host']}:${currentNetwork['port']}`);
const web3 = new Web3(provider);
const web3beta = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
//
const account = web3['_provider']['address'];
////
//
////const Web3 = require('web3');
////const web3 = new Web3(new Web3.providers.HttpProvider("http://51.0.1.99:8545"));
////const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
//
const jsonData = require("../proxy.json");
const MessageProxy = new web3.eth.Contract(jsonData['message_proxy_mainnet_abi'], jsonData['message_proxy_mainnet_address']);
const MessageProxyChain = new web3.eth.Contract(jsonData['message_proxy_chain_abi'], jsonData['message_proxy_chain_address']);
const DepositBox = new web3.eth.Contract(jsonData['deposit_box_abi'], jsonData['deposit_box_address']);
//let account = "0x6d806d42a3233336c108cece6bfa277f9a25c1d9";

async function connectChain(ChainID) {
    let res = await MessageProxy.methods.addConnectedChain(ChainID, [1, 1, 1, 1]).send({from: account, gas: 1000000});
    console.log(res);
    /*let res0 = await MessageProxy.methods.connectedChains(ChainID).call();
    console.log(res0);*/
    let res1 = await DepositBox.methods.addSchain(ChainID, jsonData['token_manager_address']).send({from: account, gas: 100000});
    console.log(res1);
    /*let res2 = await MessageProxy.methods.connectedChains(ChainID).call();
    console.log(res2);*/
    let res3 = await DepositBox.methods.deposit(ChainID, account).send({from: account, gas: 8000000, 'value': 1000000000000000000});
    console.log(res3);
    let res4 = await MessageProxyChain.methods.postIncomingMessages("Mainnet", 0, [jsonData['deposit_box_address']], [jsonData['token_manager_address']], [account], [web3.utils.toBN('1000000000000000000').toString()]).send({from: account, gas: 8000000});
    console.log(res4);
}

connectChain("Artem's Schain");
