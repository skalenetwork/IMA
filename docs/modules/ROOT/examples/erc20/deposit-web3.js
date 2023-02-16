const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

let rinkebyABIs = "[YOUR_SKALE_ABIs_ON_RINKEBY]";
let rinkebyERC20ABI = "[YOUR_ERC20_ABI_ON_RINKEBY]";

let privateKeyForMainnet = Buffer.from("[YOUR_MAINNET_ACCOUNT_PRIVATE_KEY]", 'hex')

let accountForMainnet = "[YOUR_MAINNET_ACCOUNT_ADDRESS]";
let accountForSchain = "[YOUR_SCHAIN_ACCOUNT_ADDRESS]";

let rinkeby = "[RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";
let chainId = "RINKEBY_CHAIN_ID";

const depositBoxAddress = rinkebyABIs.deposit_box_erc20_address;
const depositBoxABI = rinkebyABIs.deposit_box_erc20_abi;

const erc20ABI = rinkebyERC20ABI.erc20_abi;
const erc20Address = rinkebyERC20ABI.erc20_address;

const web3ForMainnet = new Web3(rinkeby);

let depositBox = new web3ForMainnet.eth.Contract(
  depositBoxABI,
  depositBoxAddress
);

let contractERC20 = new web3ForMainnet.eth.Contract(erc20ABI, erc20Address);

let approve = contractERC20.methods
  .approve(
    depositBoxAddress,
    web3ForMainnet.utils.toHex(web3ForMainnet.utils.toWei("1", "ether"))
  )
  .encodeABI();

let deposit = depositBox.methods
  .depositERC20(   // replace with depositERC20Direct() for specifying receiver
    schainName,
    erc20Address,
    // receiverAddress           required for depositERC20Direct()
    web3ForMainnet.utils.toHex(web3ForMainnet.utils.toWei("1", "ether"))
  )
  .encodeABI();

web3ForMainnet.eth.getTransactionCount(accountForMainnet).then(nonce => {
  //create raw transaction
  const rawTxApprove = {
    chainId: chainId,
    from: accountForMainnet,
    nonce: "0x" + nonce.toString(16),
    data: approve,
    to: erc20Address,
    gas: 6500000,
    gasPrice: 100000000000
  };

  //sign transaction
  const txApprove = new Tx(rawTxApprove, {
    chain: "rinkeby",
    hardfork: "petersburg"
  });
  txApprove.sign(privateKeyForMainnet);

  const serializedTxApprove = txApprove.serialize();

  //send signed transaction (approve)
  web3ForMainnet.eth
    .sendSignedTransaction("0x" + serializedTxApprove.toString("hex"))
    .on("receipt", receipt => {
      console.log(receipt);
      web3ForMainnet.eth
        .getTransactionCount(accountForMainnet)
        .then(nonce => {
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

          txDeposit.sign(privateKeyForMainnet);

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