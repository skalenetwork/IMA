const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnOriginChain() {
  let originABIs = require("./contracts/origin_ABIs.json");
  let originERC721ABI = require("./contracts/origin_ERC721_ABI.json");
  let targetERC721ABI = require("./contracts/target_ERC721_ABI.json");

  let privateKey = Buffer.from(
    "SCHAIN_OWNER_PRIVATE_KEY",
    "hex"
  );
  
  let erc721OwnerForOrigin =
    process.env.SCHAIN_OWNER_ACCOUNT;

  let origin = process.env.ORIGIN_ENDPOINT;
  let targetChainName = process.env.TARGET_CHAIN_NAME;
  let originChainId = process.env.ORIGIN_CHAIN_ID;

  const originTokenManagerAddress = originABIs.token_manager_erc721_address;
  const originTokenManagerABI = originABIs.token_manager_erc721_abi;

  const erc721AddressOnOrigin = originERC721ABI.erc721_address;
  const erc721AddressOnTarget = targetERC721ABI.erc721_address;

  const web3ForOrigin = new Web3(origin);

  let TokenManager = new web3ForOrigin.eth.Contract(
    originTokenManagerABI,
    originTokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC721
   * contract function addERC721TokenByOwner
   */
let addERC721TokenByOwner = TokenManager.methods
    .addERC721TokenByOwner(targetChainName, erc721AddressOnOrigin, erc721AddressOnTarget)
    .encodeABI();

    web3ForOrigin.eth.getTransactionCount(erc721OwnerForOrigin).then((nonce) => {
    const rawTxAddERC721TokenByOwner = {
      chainId: originChainId,
      from: erc721OwnerForOrigin,
      nonce: "0x" + nonce.toString(16),
      data: addERC721TokenByOwner,
      to: originTokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForOrigin.utils.toHex(
        web3ForOrigin.utils.toWei("0", "ether")
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
    web3ForOrigin.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });
