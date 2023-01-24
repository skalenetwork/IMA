const Web3 = require('web3');
const Tx = require('ethereumjs-tx');

let rinkebyABIs = require("[YOUR_SKALE_ABIs_ON_RINKEBY]");
let privateKey = Buffer.from('[YOUR_PRIVATE_KEY]', 'hex')
let account = "[YOUR_ACCOUNT_ADDRESS]";
let rinkeby = "[RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";
let chainID = "[ETHEREUM_CHAIN_ID]";

const depositBoxAddress = rinkebyABIs.deposit_box_eth_address;
const depositBoxABI = rinkebyABIs.deposit_box_eth_abi;

const web3 = new Web3(rinkeby);

let contract = new web3.eth.Contract(depositBoxABI, depositBoxAddress);

/* 
 * prepare the smart contract function 
 * deposit(string schainID, address to)
 */
let deposit = contract.methods
  .deposit(
    schainName
    )
  .encodeABI();

//get nonce
web3.eth.getTransactionCount(account).then(nonce => {
  
  //create raw transaction to send 1 ETH
  const rawTx = {
    chainId: chainId,
    from: account,
    nonce: "0x" + nonce.toString(16),
    data: deposit,
    to: depositBoxAddress,
    gas: 6500000,
    gasPrice: 100000000000,
    value: web3.utils.toHex(web3.utils.toWei("1", "ether"))
  };

  //sign transaction
  const tx = new Tx(rawTx);
  tx.sign(privateKey);

  //serialize transaction
  const serializedTx = tx.serialize();

  //send signed transaction
  web3.eth
    .sendSignedTransaction("0x" + serializedTx.toString("hex"))
    .on("receipt", receipt => {
      //record receipt to console
      console.log(receipt);
    })
    .catch(console.error);
});