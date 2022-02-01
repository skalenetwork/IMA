const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnOriginChain() {
  let originChainABIs = require("./contracts/originChain_ABIs.json");
  let originChainERC20ABI = require("./contracts/originChain_ERC20_ABI.json");

  let privateKey = Buffer.from(
    "SCHAIN_OWNER_PRIVATE_KEY",
    "hex"
  );
  
  let erc20OwnerForOriginChain =
    process.env.SCHAIN_OWNER_ACCOUNT;

  let originChain = process.env.REACT_APP_INSECURE_RINKEBY;
  let destinationChainName = process.env.DESTINATION_CHAIN_NAME;
  let originChainId = process.env.ORIGIN_CHAIN_ID;

  const originChainTokenManagerAddress = originChainABIs.token_manager_erc20_address;
  const originChainTokenManagerABI = originChainABIs.token_manager_erc20_abi;

  const erc20AddressOnOriginChain = originChainERC20ABI.erc20_address;

  const web3ForOriginChain = new Web3(originChain);

  let TokenManager = new web3ForOriginChain.eth.Contract(
    originChainTokenManagerABI,
    originChainTokenManagerAddress
  );

  /**
   * Uses the SKALE TokenManagerERC20
   * contract function addERC20TokenByOwner
   */
let addERC20TokenByOwner = TokenManager.methods
    .addERC20TokenByOwner(schainName, erc20AddressOnMainnet)
    .encodeABI();

  web3ForOriginChain.eth.getTransactionCount(erc20OwnerForMainnet).then((nonce) => {
    const rawTxAddERC20TokenByOwner = {
      chainId: chainId,
      from: erc20OwnerForOriginChain,
      nonce: "0x" + nonce.toString(16),
      data: addERC20TokenByOwner,
      to: originChainTokenManagerAddress,
      gas: 6500000,
      gasPrice: 100000000000,
      value: web3ForOriginChain.utils.toHex(
        web3ForOriginChain.utils.toWei("0", "ether")
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
    web3ForOriginChain.eth
      .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .catch(console.error);
  });