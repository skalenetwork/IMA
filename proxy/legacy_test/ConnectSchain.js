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

let web3Mainnet = new Web3(new Web3.providers.HttpProvider(mainnetRPC));
let web3Schain = new Web3(new Web3.providers.HttpProvider(schainRPC));

let privateKeyMainnetBuffer = new Buffer(privateKeyForMainnet, 'hex');
let privateKeySchainBuffer = new Buffer(privateKeyForSchain, 'hex');

let DepositBox = new web3Mainnet.eth.Contract(depositBoxABI, depositBoxAddress);
let LockAndDataForMainnet = new web3Mainnet.eth.Contract(lockAndDataForMainnetABI, lockAndDataForMainnetAddress);
let MessageProxyMainnet = new web3Mainnet.eth.Contract(messageProxyMainnetABI, messageProxyMainnetAddress);
let LockAndDataForSchain = new web3Schain.eth.Contract(lockAndDataForSchainABI, lockAndDataForSchainAddress);

let registerSchain = LockAndDataForMainnet.methods.addSchain(schainName, schainData.token_manager_address).encodeABI();
let connectSchain = MessageProxyMainnet.methods.addConnectedChain(schainName, [0, 0, 0, 0]).encodeABI();
let addDepositBox = LockAndDataForSchain.methods.addDepositBox(depositBoxAddress).encodeABI();

async function sendTransaction(web3Inst, account, privateKey, data, receiverContract) {
    await web3Inst.eth.getTransactionCount(account).then(nonce => {
        const rawTx = {
            from: account,
            nonce: "0x" + nonce.toString(16),
            data: data,
            to: receiverContract,
            gasPrice: 0,
            gas: 8000000
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

async function ConnectSchain() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, connectSchain, messageProxyMainnetAddress);
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, registerSchain, lockAndDataForMainnetAddress);
    await sendTransaction(web3Schain, accountSchain, privateKeySchainBuffer, addDepositBox, lockAndDataForSchainAddress);
}

ConnectSchain();