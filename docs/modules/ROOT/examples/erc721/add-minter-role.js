import Common from "ethereumjs-common";
const Tx = require("ethereumjs-tx").Transaction;
const Web3 = require("web3");

let schainABIs = "[YOUR_SKALE_CHAIN_ABIs]";
let schainERC721ABI = "[YOUR_SCHAIN_ERC721_ABI]";
let chainId = "[YOUR_SKALE_CHAIN_CHAIN_ID]";

const customCommon = Common.forCustomChain(
    "mainnet",
    {
      name: "skale-network",
      chainId: chainId
    },
    "istanbul"
  );

let contractOwnerPrivateKey = new Buffer("[YOUR_PRIVATE_KEY]", 'hex');

let contractOwnerAccount = "[CONTRACT_OWNER_ACCOUNT]"; // SKALE Chain owner or authorized deployer account

let schainEndpoint = "[YOUR_SKALE_CHAIN_ENDPOINT]";

const erc721ABI = schainERC721ABI.erc721_abi;
const erc721Address = schainERC721ABI.erc721_address;

const tokenManagerAddress = schainABIs.token_manager_erc721_address;

const web3ForSchain = new Web3(schainEndpoint);

let schainERC721Contract = new web3ForSchain.eth.Contract(
  erc721ABI,
  erc721Address
);

let addMinter = schainERC721Contract.methods
    .addMinter(tokenManagerAddress)
    .encodeABI();

  web3ForSchain.eth.getTransactionCount(contractOwnerAccount).then((nonce) => {
    //create raw transaction
    const rawTxAddMinter = {
      from: contractOwnerAccount,
      nonce: nonce,
      data: addMinter,
      to: erc721Address,
      gasPrice: 100000000000,
      gas: 8000000
    };
    //sign transaction
    const txAddMinter = new Tx(rawTxAddMinter, { common: customCommon });
    txAddMinter.sign(contractOwnerPrivateKey);

    const serializedTxAddMinter = txAddMinter.serialize();

    //send signed transaction (add minter)
    web3ForSchain.eth
      .sendSignedTransaction("0x" + serializedTxAddMinter.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });