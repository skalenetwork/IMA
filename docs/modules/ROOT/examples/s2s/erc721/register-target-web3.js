const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnTargetChain() {
  let targetABIs = require("./contracts/target_ABIs.json");
  let originERC721ABI = require("./contracts/origin_ERC721_ABI.json");
  let targetERC721ABI = require("./contracts/target_ERC721_ABI.json");

  let privateKey = Buffer.from(
    "SCHAIN_OWNER_PRIVATE_KEY",
    "hex"
  );
  
  let erc721OwnerForTarget =
    process.env.SCHAIN_OWNER_ACCOUNT;

  let target = process.env.TARGET_ENDPOINT;
  let originChainName = process.env.ORIGIN_CHAIN_NAME;
  let targetChainId = process.env.TARGET_CHAIN_ID;

  const targetTokenManagerAddress = targetABIs.token_manager_erc721_address;
  const targetTokenManagerABI = targetABIs.token_manager_erc721_abi;

  const erc721AddressOnOrigin = originERC721ABI.erc721_address;
  const erc721AddressOnTarget = targetERC721ABI.erc721_address;

  const web3ForTarget = new Web3(target);

  let TokenManager = new web3ForTarget.eth.Contract(
    targetTokenManagerABI,
    targetTokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC721
   * contract function addERC721TokenByOwner
   */
let addERC721TokenByOwner = TokenManager.methods
    .addERC721TokenByOwner(originChainName, erc721AddressOnOrigin, erc721AddressOnTarget)
    .encodeABI();     // IMPORTANT: arguments here are not symmetric to origin addERC721TokenByOwner

    web3ForTarget.eth.getTransactionCount(erc721OwnerForTarget).then((nonce) => {
    const rawTxAddERC721TokenByOwner = {
      chainId: targetChainId,
      from: erc721OwnerForTarget,
      nonce: "0x" + nonce.toString(16),
      data: addERC721TokenByOwner,
      to: targetTokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForTarget.utils.toHex(
        web3ForTarget.utils.toWei("0", "ether")
      )
    };

    //sign transaction
    const txAddERC721TokenByOwner = new Tx(rawTxAddERC721TokenByOwner, {
      chain: "rinkeby",
      hardfork: "petersburg"
    });

    txAddERC721TokenByOwner.sign(privateKey);

    const serializedTxDeposit = txAddERC721TokenByOwner.serialize();

    //send signed transaction (addERC721TokenByOwner)
    web3ForTarget.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });
