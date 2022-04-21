// import & init ima-js here

export function initTestTokenContract(ima) {
  // initialize ERC1155 contract
  const abiData = require("[ERC1155_ABI_ON_ETHEREUM]");
  return new ima.mainnet.web3.eth.Contract(
    abiData.erc1155_abi,
    abiData.erc1155_address);
}


export function initTestTokenContractSchain(ima) {
  // initialize ERC1155 contract
  const abiData = require("[ERC1155_ABI_ON_SCHAIN]");
  return new ima.schain.web3.eth.Contract(
    abiData.erc1155_abi,
    abiData.erc1155_address);
}


export async function withdrawERC1155Single(ima) {
  let tokenName = "[ERC1155_TOKEN_NAME]";
  let erc1155TokenId = "[ID_OF_THE_TOKEN_TO_TRANSFER]";
  let amount = "[AMOUNT_IN_WEI]";

  let mainnetERC1155 = initTestTokenContract(ima);
  let schainERC1155 = initTestTokenContractSchain(ima);

  ima.addERC1155Token(tokenName, mainnetERC1155, schainERC1155);

  let address = "[YOUR_ADDRESS]";
  let privateKey = "[YOUR_PRIVATE_KEY]";

  let opts = { // transaction options
    address: address,
    privateKey: privateKey // remove privateKey from opts to use Metamask signing
  };

  let balanceMainnet = await ima.mainnet.getERC1155Balance(mainnetERC1155, address, erc1155TokenId); // get balance on the sChain before the transfer

  await ima.schain.erc1155.approveAll(tokenName, erc1155TokenId, opts);
  await ima.withdrawERC1155(erc1155Name, erc1155TokenId, amount, opts);
  await ima.mainnet.waitERC1155BalanceChange(mainnetERC1155, address, erc1155TokenId, balanceMainnet);
}