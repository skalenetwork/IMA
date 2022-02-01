import Common from "ethereumjs-common";
const Tx = require("ethereumjs-tx").Transaction;
const Web3 = require("web3");

export function addMinter() {
  let schainABIs = require("./contracts/schain_ABIs.json");
  let schainERC20ABI = require("./contracts/schain_ERC20_ABI.json");

  let contractOwnerPrivateKey = Buffer.from(
    "CONTRACT_OWNER_PRIVATE_KEY",
    "hex"
  );
  let contractOwnerAccount =
    process.env.REACT_APP_INSECURE_CONTRACT_OWNER_ACCOUNT;

  let schainEndpoint = process.env.REACT_APP_INSECURE_SKALE_CHAIN;
  let chainId = process.env.REACT_APP_INSECURE_CHAIN_ID;

  const customCommon = Common.forCustomChain(
    "mainnet",
    {
      name: "skale-network",
      chainId: chainId
    },
    "istanbul"
  );

  const erc20ABI = schainERC20ABI.erc20_abi;
  const erc20Address = schainERC20ABI.erc20_address;

  const tokenManagerERC20Address = schainABIs.token_manager_erc20_address;

  const web3ForSchain = new Web3(schainEndpoint);

  let schainERC20Contract = new web3ForSchain.eth.Contract(
    erc20ABI,
    erc20Address
  );

  /**
   * Uses the openzeppelin ERC20Mintable
   * contract function addMinter
   * https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/token/ERC20
   */
let addMinter = schainERC20Contract.methods
    .addMinter(tokenManagerERC20Address)
    .encodeABI();

  web3ForSchain.eth.getTransactionCount(contractOwnerAccount).then((nonce) => {
    //create raw transaction
    const rawTxAddMinter = {
      chainId: chainId,
      from: contractOwnerAccount,
      nonce: nonce,
      data: addMinter,
      to: erc20Address,
      gasPrice: 100000000000,
      gas: 8000000,
      value: 0
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