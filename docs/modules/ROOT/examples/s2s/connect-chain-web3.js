const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

let schainABIs = require("[YOUR_SKALE_CHAIN_ABIs]");
let privateKey = Buffer.from('[YOUR_PRIVATE_KEY]', 'hex')
let account = "[YOUR_ACCOUNT_ADDRESS]";
let schainEndpoint = "[YOUR_SKALE_CHAIN_ENDPOINT]";
let chainId = "ORIGIN_CHAIN_ID";
let targetSchainName = "TARGET_SKALE_CHAIN_NAME";

const tokenManagerLinkerAddress = schainABIs.token_manager_linker_address;
const tokenManagerLinkerABI = schainABIs.token_manager_linker_abi;

const web3 = new Web3(new Web3.providers.HttpProvider(schainEndpoint));

let contract = new web3.eth.Contract(
  tokenManagerLinkerABI, 
  tokenManagerLinkerAddress
);

/* 
 * Prepare connectSchain
 */
let connectSchain = contract.methods.connectSchain(targetSchainName)
  .encodeABI();  

//get nonce
web3.eth.getTransactionCount(account).then((nonce) => {
  //create raw transaction
  const rawTx = {
    chainId: chainId,
    nonce: "0x" + nonce.toString(16),
    from: account, 
    nonce: "0x" + nonce.toString(16),
    data : connectSchain,
    to: tokenManagerLinkerAddress,
    gasPrice: 100000000000,
    gas: 8000000
  }

  //sign transaction
  const tx = new Tx(rawTx);
  tx.sign(privateKey);

  //serialize transaction
  const serializedTx = tx.serialize();

  //send signed transaction
  web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).
    on('receipt', receipt => {
      //record receipt to console
      console.log(receipt);
   }).
    catch(console.error);
});