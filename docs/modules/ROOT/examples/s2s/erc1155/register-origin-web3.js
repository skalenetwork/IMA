const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnOriginChain() {
  let originABIs = require("./contracts/origin_ABIs.json");
  let originERC1155ABI = require("./contracts/origin_ERC1155_ABI.json");
  let targetERC1155ABI = require("./contracts/target_ERC1155_ABI.json");

  let privateKey = Buffer.from(
    "SCHAIN_OWNER_PRIVATE_KEY",
    "hex"
  );
  
  let erc1155OwnerForOrigin =
    process.env.SCHAIN_OWNER_ACCOUNT;

  let origin = process.env.ORIGIN_ENDPOINT;
  let targetChainName = process.env.TARGET_CHAIN_NAME;
  let originChainId = process.env.ORIGIN_CHAIN_ID;

  const originTokenManagerAddress = originABIs.token_manager_erc1155_address;
  const originTokenManagerABI = originABIs.token_manager_erc1155_abi;

  const erc1155AddressOnOrigin = originERC1155ABI.erc1155_address;
  const erc1155AddressOnTarget = targetERC1155ABI.erc1155_address;

  const web3ForOrigin = new Web3(origin);

  let TokenManager = new web3ForOrigin.eth.Contract(
    originTokenManagerABI,
    originTokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC1155
   * contract function addERC1155TokenByOwner
   */
let addERC1155TokenByOwner = TokenManager.methods
    .addERC1155TokenByOwner(targetChainName, erc1155AddressOnOrigin, erc1155AddressOnTarget)
    .encodeABI();

    web3ForOrigin.eth.getTransactionCount(erc1155OwnerForOrigin).then((nonce) => {
    const rawTxAddERC1155TokenByOwner = {
      chainId: originChainId,
      from: erc1155OwnerForOrigin,
      nonce: "0x" + nonce.toString(16),
      data: addERC1155TokenByOwner,
      to: originTokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForOrigin.utils.toHex(
        web3ForOrigin.utils.toWei("0", "ether")
      )
    };

    //sign transaction
    const txAddERC1155TokenByOwner = new Tx(rawTxAddERC1155TokenByOwner, {
      chain: "rinkeby",
      hardfork: "petersburg"
    });

    txAddERC1155TokenByOwner.sign(privateKey);

    const serializedTxDeposit = txAddERC1155TokenByOwner.serialize();

    //send signed transaction (addERC1155TokenByOwner)
    web3ForOrigin.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });
