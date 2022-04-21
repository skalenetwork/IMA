const Web3 = require("web3");
import Common from "ethereumjs-common";
const Tx = require("ethereumjs-tx").Transaction;

let schainABIs = "[YOUR_SKALE_CHAIN_ABIs]";
let rinkebyERC20ABI = "[YOUR_RINKEBY_ERC20_ABI]";
let schainERC20ABI = "[YOUR_SKALE_CHAIN_ERC20_ABI]";

let privateKeyForSchain = Buffer.from("YOUR_SCHAIN_ADDRESS_PRIVATE_KEY", 'hex')

let accountForSchain = "[YOUR_SCHAIN_ADDRESS]";
let schainEndpoint = "[YOUR_SKALE_CHAIN_ENDPOINT]";
let chainId = "YOUR_SCHAIN_CHAIN_ID";

const customCommon = Common.forCustomChain(
    "mainnet",
    {
      name: "skale-network",
      chainId: chainId
    },
    "istanbul"
  );

const tokenManagerAddress = schainABIs.token_manager_erc20_address;
const tokenManagerABI = schainABIs.token_manager_erc20_abi;

const schainERC20ABI = schainERC20ABI.erc20_abi;
const schainERC20Address = schainERC20ABI.erc20_address;

const erc20AddressOnMainnet = rinkebyERC20ABI.erc20_address;

const web3ForSchain = new Web3(schainEndpoint);

let tokenManager = new web3ForSchain.eth.Contract(
  tokenManagerABI,
  tokenManagerAddress
);

let contractERC20 = new web3ForSchain.eth.Contract(
  schainERC20ABI, 
  schainERC20Address
);

//approve the ERC20 transfer 
let approve = contractERC20.methods
  .approve(
    tokenManagerAddress,
    web3ForSchain.utils.toHex(web3ForSchain.utils.toWei("1", "ether"))
  )
  .encodeABI();

/**
   * Uses the SKALE TokenManager
   * contract function exitToMainERC20
   */
let exit = tokenManager.methods
  .exitToMainERC20(
    erc20AddressOnMainnet,
    web3ForSchain.utils.toHex(web3ForSchain.utils.toWei("1", "ether"))
  )
  .encodeABI();

//get nonce
web3ForSchain.eth.getTransactionCount(accountForSchain).then(nonce => {
  
  //create raw transaction (approval)
  const rawTxApprove = {
    chainId: chainId,
    from: accountForSchain,
    nonce: "0x" + nonce.toString(16),
    data: approve,
    to: erc20Address,
    gasPrice: 100000000000,
    gas: 8000000
  };

  //sign transaction (approval)
  const txApprove = new Tx(rawTxApprove, { common: customCommon });
  txApprove.sign(privateKeyForSchain);

  //serialize transaction  (approval)
  const serializedTxApprove = txApprove.serialize();

  //send signed transaction (approval)
  web3ForSchain.eth
    .sendSignedTransaction("0x" + serializedTxApprove.toString("hex"))
    .on("receipt", receipt => {
      console.log(receipt);

      //get next nonce
      web3ForSchain.eth.getTransactionCount(accountForSchain).then(nonce => {
        
        //create raw transaction (exit)
        const rawTxExit = {
          chainId: chainId,
          from: accountForSchain,
          nonce: "0x" + nonce.toString(16),
          data: exit,
          to: tokenManagerAddress,
          gasPrice: 100000000000,
          gas: 8000000
        };

        //sign transaction (exit)
        const txExit = new Tx(rawTxExit, { common: customCommon });
        txExit.sign(privateKeyForSchain);

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