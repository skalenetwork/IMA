require('dotenv').config();
const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
let mainnetData = require("../data/proxyMainnet.json");
let schainData = require("../data/proxySchain.json");

let mainnetRPC = process.env.MAINNET_RPC_URL;
let schainRPC = process.env.SCHAIN_RPC_URL;
let accountMainnet = process.env.ACCOUNT_FOR_MAINNET;
let accountSchain = process.env.ACCOUNT_FOR_SCHAIN;
let schainName = process.env.SCHAIN_NAME;
let privateKeyForMainnet = process.env.MNEMONIC_FOR_MAINNET;
let privateKeyForSchain = process.env.MNEMONIC_FOR_SCHAIN;

let messageProxyMainnetAddress = mainnetData.message_proxy_mainnet_address;
let messageProxyMainnetABI = mainnetData.message_proxy_mainnet_abi;

let depositBoxAddress = mainnetData.deposit_box_address;
let depositBoxABI = mainnetData.deposit_box_abi;

let lockAndDataForMainnetAddress = mainnetData.lock_and_data_for_mainnet_address;
let lockAndDataForMainnetABI = mainnetData.lock_and_data_for_mainnet_abi;

let lockAndDataForSchainAddress = schainData.lock_and_data_for_schain_address;
let lockAndDataForSchainABI = schainData.lock_and_data_for_schain_abi;

let ethERC20Address = schainData.eth_erc20_address;
let ethERC20ABI = schainData.eth_erc20_abi;

let tokenManagerAddress = schainData.token_manager_address;
let tokenManagerABI = schainData.token_manager_abi;

let web3Mainnet = new Web3(new Web3.providers.HttpProvider(mainnetRPC));
let web3Schain = new Web3(new Web3.providers.HttpProvider(schainRPC));

let privateKeyMainnetBuffer = new Buffer(privateKeyForMainnet, 'hex');
let privateKeySchainBuffer = new Buffer(privateKeyForSchain, 'hex');

let DepositBox = new web3Mainnet.eth.Contract(depositBoxABI, depositBoxAddress);
let LockAndDataForMainnet = new web3Mainnet.eth.Contract(lockAndDataForMainnetABI, lockAndDataForMainnetAddress);
let MessageProxyMainnet = new web3Mainnet.eth.Contract(messageProxyMainnetABI, messageProxyMainnetAddress);
let LockAndDataForSchain = new web3Schain.eth.Contract(lockAndDataForSchainABI, lockAndDataForSchainAddress);
let EthERC20 = new web3Schain.eth.Contract(ethERC20ABI, ethERC20Address);
let TokenManager = new web3Schain.eth.Contract(tokenManagerABI, tokenManagerAddress);


let deposit = DepositBox.methods.deposit(schainName, accountMainnet).encodeABI();

let exitToMain = TokenManager.methods.exitToMain(accountMainnet, "1000000000000000000").encodeABI();

let getMyEth = LockAndDataForMainnet.methods.getMyEth().encodeABI();

async function sendTransaction(web3Inst, account, privateKey, data, receiverContract, amount) {
    await web3Inst.eth.getTransactionCount(account).then(nonce => {
        const rawTx = {
            from: account,
            nonce: "0x" + nonce.toString(16),
            data: data,
            to: receiverContract,
            gasPrice: 0,
            gas: 8000000,
            value: web3Inst.utils.toHex(amount)
        };

        const tx = new Tx(rawTx);
        tx.sign(privateKey);
    
        const serializedTx = tx.serialize();

        web3Inst.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', receipt => {
            console.log(receipt);
        });
    });

    console.log("Transaction done!");
}

async function sendMoneyToSchain() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, deposit, depositBoxAddress, "1000000000000000000");
}

async function sendMoneyToMainnet() {
    await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, exitToMain, tokenManagerAddress, 0);
}

async function getMyETH() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, getMyEth, lockAndDataForMainnetAddress, 0);
}

//sendMoneyToMainnet();
//sendMoneyToSchain();
getMyETH();