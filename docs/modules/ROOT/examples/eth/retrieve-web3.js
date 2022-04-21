
const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

let rinkebyABIs = require("[YOUR_RINKEBY_ABIs]");
let privateKey = new Buffer('[YOUR_PRIVATE_KEY]', 'hex')
let account = "[YOUR_ACCOUNT_ADDRESS]";
let rinkeby = "[YOUR_RINKEBY_ENDPOINT]";
let chainId = "[RINKEBY_CHAIN_ID";

const depositBoxAddress = rinkebyABIs.deposit_box_eth_address;
const depositBoxABI = rinkebyABIs.deposit_box_eth_abi;

const web3 = new Web3(rinkeby);

let DepositBox = new web3.eth.Contract(depositBoxABI, depositBoxAddress);

/*
  * prepare the function
  * getMyEth()
  */
let getMyEth = DepositBox.methods.getMyEth().encodeABI();

//get nonce
web3.eth.getTransactionCount(account).then((nonce) => {
  //create raw transaction
  const rawTxGetMyEth = {
    chainId: chainId,
    from: account,
    nonce: "0x" + nonce.toString(16),
    data: getMyEth,
    to: depositBoxAddress,
    gas: 6500000,
    gasPrice: 100000000000
  };

    //sign transaction
    const txGetMyEth = new Tx(rawTxGetMyEth, {
      chain: "rinkeby",
      hardfork: "petersburg"
    });
    txGetMyEth.sign(privateKey);

    //serialize transaction
    const serializedTxGetMyEth = txGetMyEth.serialize();

    //send signed transaction
    web3.eth
      .sendSignedTransaction("0x" + serializedTxGetMyEth.toString("hex"))
      .on("receipt", (receipt) => {
        //record receipt to console
        console.log(receipt);
      })
      .catch(console.error);
});
