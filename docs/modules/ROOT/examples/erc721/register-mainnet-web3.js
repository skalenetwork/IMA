const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

let rinkebyABIs = "[YOUR_RINKEBY_ABIs]";
let rinkebyERC721ABI = "[YOUR_RINKEBY_ERC721_ABI]";

let privateKey = new Buffer("[YOUR_PRIVATE_KEY]", 'hex');

let erc721OwnerForMainnet = "[YOUR_ERC721_MAINNET_OWNER]";

let rinkeby = "[YOUR_RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";
let chainId = "[YOUR_RINKEBY_CHAIN_ID]";

const depositBoxAddress = rinkebyABIs.deposit_box_erc721_address;
const depositBoxABI = rinkebyABIs.deposit_box_erc721_abi;

const erc721AddressOnMainnet = rinkebyERC721ABI.erc721_address;

const web3ForMainnet = new Web3(rinkeby);

let DepositBox = new web3ForMainnet.eth.Contract(
  depositBoxABI,  
  depositBoxAddress
);

let addERC721TokenByOwner = DepositBox.methods
    .addERC721TokenByOwner(schainName, erc721AddressOnMainnet)
    .encodeABI();

  web3ForMainnet.eth.getTransactionCount(erc721OwnerForMainnet).then((nonce) => {
    const rawTxAddERC721TokenByOwner = {
      chainId: chainId,
      from: erc721OwnerForMainnet,
      nonce: "0x" + nonce.toString(16),
      data: addERC721TokenByOwner,
      to: depositBoxAddress,
      gas: 6500000,
      gasPrice: 100000000000
    };

    //sign transaction
    const txAddERC721TokenByOwner = new Tx(rawTxAddERC721TokenByOwner, {
        chain: "rinkeby",
        hardfork: "petersburg"
      });

    txAddERC721TokenByOwner.sign(privateKey);

    const serializedTxDeposit = txAddERC721TokenByOwner.serialize();

    //send signed transaction (addERC721TokenByOwner)
    web3ForMainnet.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });