
import Common from "ethereumjs-common";
const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

let schainABIs = "[YOUR_SKALE_CHAIN_ABIs]";
let schainERC1155ABI = "[YOUR_SCHAIN_ERC1155_ABI]";
let rinkebyERC1155ABI = "[YOUR_RINKEBY_ERC1155_ABI]";

let privateKey = new Buffer("[YOUR_PRIVATE_KEY]", 'hex');

let erc1155OwnerForSchain = "[YOUR_SCHAIN_ADDRESS]";

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

const tokenManagerAddress = schainABIs.token_manager_erc1155_address;
const tokenManagerABI = schainABIs.token_manager_erc1155_abi;

const erc1155AddressOnMainnet = rinkebyERC1155ABI.erc1155_address;
const erc1155AddressOnSchain = schainERC1155ABI.erc1155_address;

const web3ForSchain = new Web3(schainEndpoint);

let TokenManager = new web3ForSchain.eth.Contract(
    tokenManagerABI,
    tokenManagerAddress
);

let addERC1155TokenByOwner = TokenManager.methods
    .addERC1155TokenByOwner(
      "Mainnet",
      erc1155AddressOnMainnet,
      erc1155AddressOnSchain
    )
    .encodeABI();

  web3ForSchain.eth.getTransactionCount(erc1155OwnerForSchain).then((nonce) => {
    const rawTxAddERC1155TokenByOwner = {
      from: erc1155OwnerForSchain,
      nonce: "0x" + nonce.toString(16),
      data: addERC1155TokenByOwner,
      to: tokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000
    };

    //sign transaction
    const txAddERC1155TokenByOwner = new Tx(rawTxAddERC1155TokenByOwner, {
      common: customCommon
    });

    txAddERC1155TokenByOwner.sign(privateKey);

    const serializedTxDeposit = txAddERC1155TokenByOwner.serialize();

    web3ForSchain.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });