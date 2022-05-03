const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnTargetChain() {
  let targetABIs = require("./contracts/target_ABIs.json");
  let originERC1155ABI = require("./contracts/origin_ERC1155_ABI.json");
  let targetERC1155ABI = require("./contracts/target_ERC1155_ABI.json");

  let privateKey = Buffer.from(
    "SCHAIN_OWNER_PRIVATE_KEY",
    "hex"
  );
  
  let erc1155OwnerForTarget =
    process.env.SCHAIN_OWNER_ACCOUNT;

  let target = process.env.TARGET_ENDPOINT;
  let originChainName = process.env.ORIGIN_CHAIN_NAME;
  let targetChainId = process.env.TARGET_CHAIN_ID;

  const targetTokenManagerAddress = targetABIs.token_manager_erc1155_address;
  const targetTokenManagerABI = targetABIs.token_manager_erc1155_abi;

  const erc1155AddressOnOrigin = originERC1155ABI.erc1155_address;
  const erc1155AddressOnTarget = targetERC1155ABI.erc1155_address;

  const web3ForTarget = new Web3(target);

  let TokenManager = new web3ForTarget.eth.Contract(
    targetTokenManagerABI,
    targetTokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC1155
   * contract function addERC1155TokenByOwner
   */
let addERC1155TokenByOwner = TokenManager.methods
    .addERC20TokenByOwner(originChainName, erc20AddressOnOrigin, erc20AddressOnTarget)
    .encodeABI();     // IMPORTANT: arguments here are not symmetric to origin addERC1155TokenByOwner

    web3ForTarget.eth.getTransactionCount(erc20OwnerForTarget).then((nonce) => {
    const rawTxAddERC1155TokenByOwner = {
      chainId: targetChainId,
      from: erc20OwnerForTarget,
      nonce: "0x" + nonce.toString(16),
      data: addERC20TokenByOwner,
      to: targetTokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForTarget.utils.toHex(
        web3ForTarget.utils.toWei("0", "ether")
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
    web3ForTarget.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });
