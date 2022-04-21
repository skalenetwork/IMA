
import Common from "ethereumjs-common";
const Tx = require("ethereumjs-tx").Transaction;
const Web3 = require("web3");

let schainABIs = "[YOUR_SKALE_CHAIN_ABIs]";
let schainERC1155ABI = "[YOUR_SCHAIN_ERC1155_ABI]";
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

const erc1155ABI = schainERC1155ABI.erc1155_abi;
const erc1155Address = schainERC1155ABI.erc1155_address;

const tokenManagerAddress = schainABIs.token_manager_erc1155_address;

const web3ForSchain = new Web3(schainEndpoint);

let schainERC1155Contract = new web3ForSchain.eth.Contract(
    erc1155ABI,
    erc1155Address
);

let addMinter = schainERC1155Contract.methods
    .addMinter(tokenManagerAddress)
    .encodeABI();

  web3ForSchain.eth.getTransactionCount(contractOwnerAccount).then((nonce) => {
    //create raw transaction
    const rawTxAddMinter = {
      from: contractOwnerAccount,
      nonce: nonce,
      data: addMinter,
      to: erc1155Address,
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