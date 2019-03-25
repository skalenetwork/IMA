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
const jsonDataMainnet = require("../proxyMainnet.json");
const jsonDataSchain = require("../proxySchain.json")
const MessageProxy = new web3.eth.Contract(jsonDataMainnet['message_proxy_mainnet_abi'], jsonDataMainnet['message_proxy_mainnet_address']);
const MessageProxyChain = new web3.eth.Contract(jsonDataSchain['message_proxy_chain_abi'], jsonDataSchain['message_proxy_chain_address']);

let TokenABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"initialSupply","type":"uint256"},{"name":"tokenName","type":"string"},{"name":"tokenSymbol","type":"string"},{"name":"owner","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_spender","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Burn","type":"event"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"},{"name":"_extraData","type":"bytes"}],"name":"approveAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_value","type":"uint256"}],"name":"burn","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_value","type":"uint256"}],"name":"burnFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];

const TokenAddress = "0xf874dbabc49af117604d8c6a3a4ec2a31725a884";
const TokenOnSchainAddress = "0x3fe75c61b338c5cf6e9e086288acba44f55929ee";

const ERC20Box = new web3.eth.Contract(jsonDataMainnet['erc20_box_abi'], jsonDataMainnet['erc20_box_address']);

const TokenOnMainnet = new web3.eth.Contract(TokenABI, TokenAddress);
const TokenOnSchain = new web3.eth.Contract(TokenABI, TokenOnSchainAddress);
//let account = "0x6d806d42a3233336c108cece6bfa277f9a25c1d9";

async function connectChain(ChainID) {
    /*let res = await MessageProxy.methods.addConnectedChain(ChainID, [1, 1, 1, 1]).send({from: account, gas: 1000000});
    console.log(res);*/
    let res0 = await TokenOnMainnet.methods.approve(jsonDataMainnet['erc20_box_address'], web3.utils.toBN('1000000000000000000').toString()).send({from: account, gas: 1000000});
    console.log(res0);
    let res1 = await ERC20Box.methods.takeERC20(TokenAddress, web3.utils.toBN('1000000000000000000').toString()).send({from: account, gas: 1000000});
    console.log(res1);

    let data = TokenOnSchain.methods.transfer(account, web3.utils.toBN('1000000000000000000').toString());
    let dataToDeposit = data.encodeABI();
    console.log(dataToDeposit);
    console.log(dataToDeposit.length / 2 - 1);
    
    let res3 = await ERC20Box.methods.deposit(ChainID, account, dataToDeposit).send({from: account, gas: 8000000});
    console.log(res3);
    let res4 = await MessageProxyChain.methods.postIncomingMessages("Mainnet", 1, [jsonDataMainnet['erc20_box_address']], [jsonDataSchain['erc20_manager_address']], [TokenOnSchainAddress], [web3.utils.toBN('0').toString()], dataToDeposit, [dataToDeposit.length / 2 - 1]).send({from: account, gas: 8000000});
    console.log(res4);
}

connectChain("Mainnet2");
