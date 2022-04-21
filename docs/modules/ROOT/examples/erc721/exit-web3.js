
const Web3 = require('web3');
const Common = require('ethereumjs-common');
const Tx = require('ethereumjs-tx').Transaction;

let schainABIs = "[YOUR_SKALE_CHAIN_ABIs]");
let rinkebyERC721ABI = "[YOUR_RINKEBY_ERC721_ABI]";
let schainERC721ABI = "[YOUR_SKALE_CHAIN_ERC721_ABI]";

let privateKey = new Buffer('[YOUR_PRIVATE_KEY]', 'hex');
let accountForMainnet = "[YOUR_MAINNET_ACCOUNT_ADDRESS]";
let accountForSchain = "[YOUR_SCHAIN_ACCOUNT_ADDRESS]";
let schainEndpoint = "[YOUR_SKALE_CHAIN_ENDPOINT]";
let chainId = "[YOUR_SKALE_CHAIN_CHAIN_ID]";

const customCommon = Common.forCustomChain(
    "mainnet",
    {
      name: "skale-network",
      chainId: chainId
    },
    "istanbul"
  );

let mintId = "[ERC721_MINT_ID]";

const tokenManagerAddress = schainABIs.token_manager_erc721_address;
const tokenManagerABI = schainABIs.token_manager_erc721_abi;

const erc721ABI = schainERC721ABI.erc721_abi;

const erc721Address = schainERC721ABI.erc721_address;
const erc721AddressRinkeby = rinkebyERC721ABI.erc721_address;

const web3ForSchain = new Web3(schainEndpoint);

let tokenManager = new web3ForSchain.eth.Contract(
  tokenManagerABI,
  tokenManagerAddress
);

let contractERC721 = new web3ForSchain.eth.Contract(
  erc721ABI, 
  erc721Address
);

/**
   * Uses the openzeppelin ERC721
   * contract function transfer
   * https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/token/ERC721
   */
let approve = contractERC721.methods
  .approve(tokenManagerAddress, process.env.REACT_APP_MINT_ID)
  .encodeABI();

let exit = tokenManager.methods
  .exitToMainERC721(
    erc721AddressRinkeby,
    mintId
  )
  .encodeABI();

//get nonce
web3ForSchain.eth.getTransactionCount(accountForSchain).then((nonce) => {
  
  //create raw transaction (approval)
  const rawTxApprove = {
    from: accountForSchain,
    nonce: "0x" + nonce.toString(16),
    data: approve,
    to: erc721Address,
    gasPrice: 100000000000,
    gas: 8000000
  };

  //sign transaction
  const TxApprove = new Tx(rawTxApprove, { common: customCommon });
    TxApprove.sign(privateKey);

  const serializedTxApprove = TxApprove.serialize();

  //send signed transaction (approval)
  web3ForSchain.eth
    .sendSignedTransaction("0x" + serializedTxApprove.toString("hex"))
    .on("receipt", receipt => {
      console.log(receipt);

      //get next nonce
      web3ForSchain.eth.getTransactionCount(accountForSchain).then(nonce => {
        
        //create raw transaction (exit)
        const rawTxExit = {
          from: accountForSchain,
          nonce: "0x" + nonce.toString(16),
          data: exit,
          to: tokenManagerAddress,
          gasPrice: 100000000000,
          gas: 8000000
        };

        //sign transaction (exit)
        const txExit = new Tx(rawTxExit, { common: customCommon });
        txExit.sign(privateKey);

        const serializedTxExit = txExit.serialize();

        //send signed transaction (exit)
        web3ForSchain.eth
          .sendSignedTransaction("0x" + serializedTxExit.toString("hex"))
          .on("receipt", receipt => {
            console.log(receipt);
          })
          .catch(console.error);
      });
    })
    .catch(console.error);
});