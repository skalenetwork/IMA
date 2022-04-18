// import & init ima-js here

export function initTestTokenContract(ima) {
    // initialize ERC1155 contract
    const abiData = require("[ERC1155_ABI_ON_SCHAIN]");
    return new ima.schain.web3.eth.Contract(
      abiData.erc1155_abi,
      abiData.erc1155_address);
  }
  
  export async function exit(ima) {
    let tokenName = "[ERC1155_TOKEN_NAME";
    let erc1155TokenId = "[ID_OF_THE_TOKEN_TO_TRANSFER]";
    let amount = "[AMOUNT_IN_WEI]";
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
  
    let contractObject = initTestTokenContract(ima);
    ima.schain.addERC1155Token(tokenName, contractObject);
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let txOpts = { // transaction options
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    let balanceMainnet = await ima.mainnet.getERC1155Balance(erc1155Name, address, erc1155TokenId); // get balance on the Mainnet before the transfer
  
    await ima.schain.approveAllERC1155(erc1155Name, erc1155TokenId, opts); // approve all transfers
    
    // 1. for single object
    await ima.withdrawERC1155(tokenName, erc1155TokenId, amount, txOpts); 
    // 2. for separate sChain object
    await ima.schain.withdrawERC1155("[ADDRESS_OF_ERC1155_ON_MAINNET]", address, erc1155TokenId, amount, txOpts);
  
    // optional
    await ima.mainnet.waitERC1155BalanceChange(tokenName, address, erc1155TokenId, balanceMainnet); // wait for the balance to be changed on the Mainnet side
  }
  