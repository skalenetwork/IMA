const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnOriginChain() {
  let originABIs = require("./contracts/origin_ABIs.json");
  let originERC20ABI = require("./contracts/origin_ERC20_ABI.json");
  let targetERC20ABI = require("./contracts/target_ERC20_ABI.json");

  let privateKey = Buffer.from(
    "SCHAIN_OWNER_PRIVATE_KEY",
    "hex"
  );
  
  let erc20OwnerForOrigin =
    process.env.SCHAIN_OWNER_ACCOUNT;

  let origin = process.env.ORIGIN_ENDPOINT;
  let targetChainName = process.env.TARGET_CHAIN_NAME;
  let originChainId = process.env.ORIGIN_CHAIN_ID;

  const originTokenManagerAddress = originABIs.token_manager_erc20_address;
  const originTokenManagerABI = originABIs.token_manager_erc20_abi;

  const erc20AddressOnOrigin = originERC20ABI.erc20_address;
  const erc20AddressOnTarget = targetERC20ABI.erc20_address;

  const web3ForOrigin = new Web3(origin);

  let TokenManager = new web3ForOrigin.eth.Contract(
    originTokenManagerABI,
    originTokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC20
   * contract function addERC20TokenByOwner
   */
let addERC20TokenByOwner = TokenManager.methods
    .addERC20TokenByOwner(targetChainName, erc20AddressOnOrigin, erc20AddressOnTarget)
    .encodeABI();

    web3ForOrigin.eth.getTransactionCount(erc20OwnerForOrigin).then((nonce) => {
    const rawTxAddERC20TokenByOwner = {
      chainId: originChainId,
      from: erc20OwnerForOrigin,
      nonce: "0x" + nonce.toString(16),
      data: addERC20TokenByOwner,
      to: originTokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForOrigin.utils.toHex(
        web3ForOrigin.utils.toWei("0", "ether")
      )
    };

    //sign transaction
    const txAddERC20TokenByOwner = new Tx(rawTxAddERC20TokenByOwner, {
      chain: "rinkeby",
      hardfork: "petersburg"
    });

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