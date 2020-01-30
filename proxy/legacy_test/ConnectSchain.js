require('dotenv').config();
const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
let mainnetData = require("../data/proxyMainnet.json");
let schainData = require("../data/proxySchain_WYTE8K6S.json");

let mainnetRPC = process.env.MAINNET_RPC_URL;
let schainRPC = process.env.SCHAIN_RPC_URL;
let accountMainnet = process.env.ACCOUNT_FOR_MAINNET;
let accountSchain = process.env.ACCOUNT_FOR_SCHAIN;
let schainName = process.env.SCHAIN_NAME;
let privateKeyForMainnet = process.env.MNEMONIC_FOR_MAINNET;
let privateKeyForSchain = process.env.MNEMONIC_FOR_SCHAIN;

let messageProxyMainnetAddress = mainnetData.message_proxy_mainnet_address;
let messageProxyMainnetABI = mainnetData.message_proxy_mainnet_abi;

let messageProxySchainAddress = schainData.message_proxy_chain_address;
let messageProxySchainABI = schainData.message_proxy_chain_abi;

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
let LockAndDataForMainnet = new web3Mainnet.eth.Contract(lockAndDataForMainnetABI, "0x488c5733FB48f84F836E22531E226063Cb3856f6");
let MessageProxyMainnet = new web3Mainnet.eth.Contract(messageProxyMainnetABI, messageProxyMainnetAddress);
let MessageProxySchain = new web3Schain.eth.Contract(messageProxySchainABI, messageProxySchainAddress);
let LockAndDataForSchain = new web3Schain.eth.Contract(lockAndDataForSchainABI, "0xc4345Ea69018c9E6dc829DF362C8A9aa18b9e39e");

let registerSchain = LockAndDataForMainnet.methods.addSchain(schainName, schainData.token_manager_address).encodeABI();
let connectSchain = MessageProxyMainnet.methods.addConnectedChain(schainName, [0, 0, 0, 0]).encodeABI();
let addDepositBox = LockAndDataForSchain.methods.addDepositBox(depositBoxAddress).encodeABI();
let removeSchainLD = LockAndDataForMainnet.methods.removeSchain(schainName).encodeABI();
let setERC20Module = LockAndDataForMainnet.methods.setContract("ERC20Module", "0xDa08096b928c8e0A01457629705F83127A1BABd3").encodeABI();
let setERC721Module = LockAndDataForMainnet.methods.setContract("ERC721Module", "0xB0b147d76dF1ed70B8b34071b0082f9A3e90249f").encodeABI();
let setTokenManager = LockAndDataForSchain.methods.setContract("TokenManager", "0x3c8c03C7e594446E173d1b0b3f4E4350e73968b7").encodeABI();
let setERC20ModuleS = LockAndDataForSchain.methods.setContract("ERC20Module", "0xE1c688A4fc5a89D265b960047ca1843aD1e60077").encodeABI();
let setERC721ModuleS = LockAndDataForSchain.methods.setContract("ERC721Module", "0xb13f1919ba70a8cce7Df265f5D26353D04005047").encodeABI();

let removeConnectedSchain = MessageProxyMainnet.methods.removeConnectedChain(schainName).encodeABI();

let addressCaller = "0xA2591ff4b43f50dB29da92d4b89E2A00F0894A59";
// let addressCaller = "0xA5231C219ED4dD72A24c3a58ffc20031a60d79f4";

let addAuthCallerLDM = LockAndDataForMainnet.methods.addAuthorizedCaller(addressCaller).encodeABI();
let addAuthCallerMPM = MessageProxyMainnet.methods.addAuthorizedCaller(addressCaller).encodeABI();
let addAuthCallerMPS = MessageProxySchain.methods.addAuthorizedCaller(addressCaller).encodeABI();
let addAuthCallerLDS = LockAndDataForSchain.methods.addAuthorizedCaller(addressCaller).encodeABI();

async function sendTransaction(web3Inst, account, privateKey, data, receiverContract) {
    await web3Inst.eth.getTransactionCount(account).then(nonce => {
        const rawTx = {
            from: account,
            nonce: "0x" + nonce.toString(16),
            data: data,
            to: receiverContract,
            gasPrice: 10000000000,
            gas: 6900000
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
    // await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, connectSchain, messageProxyMainnetAddress);
    // await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, registerSchain, lockAndDataForMainnetAddress);
    // await sendTransaction(web3Schain, accountSchain, privateKeySchainBuffer, addDepositBox, lockAndDataForSchainAddress);
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, setERC20Module, "0x488c5733FB48f84F836E22531E226063Cb3856f6");
    // await sendTransaction(web3Schain, accountSchain, privateKeySchainBuffer, setERC721ModuleS, "0xc4345Ea69018c9E6dc829DF362C8A9aa18b9e39e");
}

async function addAuthorizedCallers() {
    // await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, addAuthCallerMPM, messageProxyMainnetAddress);
    // await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, addAuthCallerLDM, lockAndDataForMainnetAddress);
    await sendTransaction(web3Schain, accountSchain, privateKeySchainBuffer, addAuthCallerLDS, lockAndDataForSchainAddress);
    // await sendTransaction(web3Schain, accountSchain, privateKeySchainBuffer, addAuthCallerMPS, messageProxySchainAddress);
}

async function removeSchain() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, removeSchainLD, lockAndDataForMainnetAddress);
    // await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, removeConnectedSchain, messageProxyMainnetAddress);
}

async function hash(name) {
    let res = web3Mainnet.utils.soliditySha3(name);
    console.log(name, "transforms to", res);
}

async function messagesCheck() {
    // let res = await MessageProxyMainnet.methods.getOutgoingMessagesCounter(schainName).call();
    // let res1 = await MessageProxyMainnet.methods.getIncomingMessagesCounter(schainName).call();
    let res2 = await MessageProxySchain.methods.getOutgoingMessagesCounter("Mainnet").call();
    let res3 = await MessageProxySchain.methods.getIncomingMessagesCounter("Mainnet").call();
    // console.log("Out Msg from Mainnet:", res);
    // console.log("In Msg from Mainnet:", res1);
    console.log("Out Msg from Schain:", res2);
    console.log("In Msg from Schain:", res2);
}

// ConnectSchain();
addAuthorizedCallers();
// removeSchain();
// hash("IF4YK5EB");
// messagesCheck();