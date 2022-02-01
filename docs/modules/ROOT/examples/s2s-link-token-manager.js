const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function linkTokenManager() {
  let originABIs = require("./contracts/origin_ABIs.json");
  let originERC20ABI = require("./contracts/origin_ERC20_ABI.json");

  let privateKey = Buffer.from("SCHAIN_OWNER_PRIVATE_KEY", "hex");

  let erc20OwnerForOrigin =
    process.env.REACT_APP_INSECURE_SCHAIN_OWNER_ACCOUNT;

  let origin = "ORIGIN_CHAIN_RPC_ENDPOINT";
  let destChainName = "DESTINATION_CHAIN_NAME";
  let originChainId = "ORIGIN_CHAIN_ID";

  const customCommon = Common.forCustomChain(
    "mainnet",
    {
      name: "skale-network",
      chainId: originChainId
    },
    "istanbul"
  );

  const tokenManagerAddress = originABIs.token_manager_erc20_address;
  const tokenManagerABI = originABIs.token_manager_erc20_abi;

  const erc20AddressOnOrigin = originERC20ABI.erc20_address;

  const web3ForOrigin = new Web3(origin);

  let TokenManager = new web3ForOrigin.eth.Contract(
    tokenManagerABI,
    tokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC20
   * contract function addERC20TokenByOwner
   */
let addERC20TokenByOwner = TokenManager.methods
    .addERC20TokenByOwner(destChainName, erc20AddressOnOrigin)
    .encodeABI();

    web3ForOrigin.eth.getTransactionCount(erc20OwnerForOrigin).then((nonce) => {
    const rawTxAddERC20TokenByOwner = {
      chainId: originChainId,
      from: erc20OwnerForOrigin,
      nonce: "0x" + nonce.toString(16),
      data: addERC20TokenByOwner,
      to: tokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForOrigin.utils.toHex(
        web3ForOrigin.utils.toWei("0", "ether")
      )
    };

    //sign transaction
    const txAddERC20TokenByOwner = new Tx(rawTxAddERC20TokenByOwner, { common: customCommon });

    txAddERC20TokenByOwner.sign(privateKey);

    const serializedTxDeposit = txAddERC20TokenByOwner.serialize();

    //send signed transaction (addERC20TokenByOwner)
    web3ForOrigin.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });