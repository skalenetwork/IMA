const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

let rinkebyABIs = "[YOUR_SKALE_ABIs_ON_RINKEBY]";
let rinkebyERC1155ABI = "[YOUR_ERC1155_ABI_ON_RINKEBY]";

let privateKey = new Buffer("[YOUR_PRIVATE_KEY]", "hex");
let accountForMainnet = "[YOUR_ACCOUNT_ADDRESS]";
let accountForSchain = "[YOUR_ACCOUNT_ADDRESS]";

let rinkeby = "[RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";
let chainId = "YOUR_RINKEBY_CHAIN_ID";

let mintId = "[ERC1155_MINT_ID]";

const depositBoxAddress = rinkebyABIs.deposit_box_erc1155_address;
const depositBoxABI = rinkebyABIs.deposit_box_erc1155_abi;

const erc1155ABI = rinkebyERC1155ABI.erc1155_abi;
const erc1155Address = rinkebyERC1155ABI.erc1155_address;

const web3ForMainnet = new Web3(rinkeby);

let depositBox = new web3ForMainnet.eth.Contract(
depositBoxABI,
depositBoxAddress
);

let contractERC1155 = new web3ForMainnet.eth.Contract(
erc1155ABI,
erc1155Address
);

/**
   * Uses the openzeppelin ERC1155
   * contract function approve
   * https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/token/ERC1155
   */
let approve = contractERC1155.methods
  .approve(depositBoxAddress, "TRUE")
  .encodeABI();

let deposit = depositBox.methods
.depositERC1155(
    schainName,
    erc1155Address,
    mintId,
    web3ForMainnet.utils.toHex(web3ForMainnet.utils.toWei("1", "ether"))
.encodeABI();

web3ForMainnet.eth.getTransactionCount(accountForMainnet).then((nonce) => {
//create raw transaction
const rawTxApprove = {
  chainId: chainId,
  from: accountForMainnet,
  nonce: "0x" + nonce.toString(16),
  data: approve,
  to: erc1155Address,
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