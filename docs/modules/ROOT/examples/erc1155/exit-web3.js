
const Web3 = require('web3');
const Common = require('ethereumjs-common');
const Tx = require('ethereumjs-tx').Transaction;

let schainABIs = "[YOUR_SKALE_CHAIN_ABIs]");
let rinkebyERC1155ABI = "[YOUR_RINKEBY_ERC1155_ABI]";
let schainERC1155ABI = "[YOUR_SKALE_CHAIN_ERC1155_ABI]";

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

let mintId = "[ERC1155_MINT_ID]";

const tokenManagerAddress = schainABIs.token_manager_erc1155_address;
const tokenManagerABI = schainABIs.token_manager_erc1155_abi;

const erc1155ABI = schainERC1155ABI.erc1155_abi;

const erc1155Address = schainERC1155ABI.erc1155_address;
const erc1155AddressRinkeby = rinkebyERC1155ABI.erc1155_address;

const web3ForSchain = new Web3(schainEndpoint);

let tokenManager = new web3ForSchain.eth.Contract(
  tokenManagerABI,
  tokenManagerAddress
);

let contractERC1155 = new web3ForSchain.eth.Contract(
  erc1155ABI, 
  erc1155Address
);

/**
   * Uses the openzeppelin ERC1155
   * contract function transfer
   * https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/token/ERC1155
   */
let approve = contractERC1155.methods
  .approve(tokenManagerAddress, "TRUE")
  .encodeABI();

let exit = tokenManager.methods
  .exitToMainERC1155(
    erc1155AddressRinkeby,
    mintId,
    web3ForSchain.utils.toHex(web3ForSchain.utils.toWei("1", "ether")
  )
  .encodeABI();

//get nonce
web3ForSchain.eth.getTransactionCount(accountForSchain).then((nonce) => {
  
  //create raw transaction (approval)
  const rawTxApprove = {
    from: accountForSchain,
    nonce: "0x" + nonce.toString(16),
    data: approve,
    to: erc1155Address,
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