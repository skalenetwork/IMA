const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

let rinkebyABIs = "[YOUR_RINKEBY_ABIs]";
let rinkebyERC1155ABI = "[YOUR_RINKEBY_ERC1155_ABI]";

let privateKey = new Buffer("[YOUR_PRIVATE_KEY]", 'hex');

let erc1155OwnerForMainnet = "[YOUR_ERC1155_MAINNET_OWNER]";

let rinkeby = "[YOUR_RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";
let chainId = "[YOUR_RINKEBY_CHAIN_ID]";

const depositBoxAddress = rinkebyABIs.deposit_box_erc1155_address;
const depositBoxABI = rinkebyABIs.deposit_box_erc1155_abi;

const erc1155AddressOnMainnet = rinkebyERC1155ABI.erc1155_address;

const web3ForMainnet = new Web3(rinkeby);

let DepositBox = new web3ForMainnet.eth.Contract(
  depositBoxABI,  
  depositBoxAddress
);

/**
   * Uses the SKALE DepositBox_ERC1155
   * contract function addERC1155TokenByOwner
   */
  let addERC1155TokenByOwner = DepositBox.methods
    .addERC1155TokenByOwner(schainName, erc1155AddressOnMainnet)
    .encodeABI();

  web3ForMainnet.eth.getTransactionCount(erc1155AddressOnMainnet).then((nonce) => {
    const rawTxAddERC1155TokenByOwner = {
      chainId: chainId,
      from: erc1155OwnerForMainnet,
      nonce: "0x" + nonce.toString(16),
      data: addERC1155TokenByOwner,
      to: depositBoxAddress,
      gas: 6500000,
      gasPrice: 100000000000
    };

    //sign transaction
    const txAddERC1155TokenByOwner = new Tx(rawTxAddERC1155TokenByOwner, {
        chain: "rinkeby",
        hardfork: "petersburg"
      });

    txAddERC1155TokenByOwner.sign(privateKey);

    const serializedTxDeposit = txAddERC1155TokenByOwner.serialize();

    //send signed transaction (addERC1155TokenByOwner)
    web3ForMainnet.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });