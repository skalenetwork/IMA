
const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

let rinkebyABIs = "[YOUR_SKALE_ABIs_ON_RINKEBY]";
let rinkebyERC721ABI = "[YOUR_ERC721_ABI_ON_RINKEBY]";

let privateKey = new Buffer("[YOUR_PRIVATE_KEY]", "hex");
let accountForMainnet = "[YOUR_ACCOUNT_ADDRESS]";
let accountForSchain = "[YOUR_ACCOUNT_ADDRESS]";

let rinkeby = "[RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";
let chainId = "YOUR_RINKEBY_CHAIN_ID";

let mintId = "[ERC721_MINT_ID]";

const depositBoxAddress = rinkebyABIs.deposit_box_erc721_address;
const depositBoxABI = rinkebyABIs.deposit_box_erc721_abi;

const erc721ABI = rinkebyERC721ABI.erc721_abi;
const erc721Address = rinkebyERC721ABI.erc721_address;

const web3ForMainnet = new Web3(rinkeby);

let depositBox = new web3ForMainnet.eth.Contract(
depositBoxABI,
depositBoxAddress
);

let contractERC721 = new web3ForMainnet.eth.Contract(
erc721ABI,
erc721Address
);

/**
   * Uses the openzeppelin ERC721
   * contract function approve
   * https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/token/ERC721
   */
let approve = contractERC721.methods
  .approve(depositBoxAddress, process.env.REACT_APP_MINT_ID)
  .encodeABI();

let deposit = depositBox.methods
.depositERC721(schainName, erc721Address, mintId)
.encodeABI();

web3ForMainnet.eth.getTransactionCount(accountForMainnet).then((nonce) => {
//create raw transaction
const rawTxApprove = {
  chainId: chainId,
  from: accountForMainnet,
  nonce: "0x" + nonce.toString(16),
  data: approve,
  to: erc721Address,
  gas: 6500000,
  gasPrice: 100000000000
};
//sign transaction
const txApprove = new Tx(rawTxApprove, {
      chain: "rinkeby",
      hardfork: "petersburg"
    });
txTransfer.sign(privateKey);

const serializedTxTransfer = txApprove.serialize();

//send signed transaction (approve)
web3ForMainnet.eth
  .sendSignedTransaction("0x" + serializedTxTransfer.toString("hex"))
  .on("receipt", (receipt) => {
    console.log(receipt);
    web3ForMainnet.eth
      .getTransactionCount(accountForMainnet)
      .then((nonce) => {
        const rawTxDeposit = {
          chainId: chainId,
          from: accountForMainnet,
          nonce: "0x" + nonce.toString(16),
          data: deposit,
          to: depositBoxAddress,
          gas: 6500000,
          gasPrice: 100000000000
        };

        //sign transaction
        const txDeposit = new Tx(rawTxDeposit, {
          chain: "rinkeby",
          hardfork: "petersburg"
        });

        txDeposit.sign(privateKey);

        const serializedTxDeposit = txDeposit.serialize();

        //send signed transaction (deposit)
        web3ForMainnet.eth
          .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
          .on("receipt", receipt => {
            console.log(receipt);
          })
          .catch(console.error);
      });
  })
  .catch(console.error);
});