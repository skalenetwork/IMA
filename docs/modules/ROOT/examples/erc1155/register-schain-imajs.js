// import & init ima-js here

export async function linkERC1155TokenSchain(ima) {
    let erc1155OnMainnet = "[ADDRESS_OF_ERC1155_TOKEN_ON_MAINNET]";
    let erc1155OnSchain = "[ADDRESS_OF_ERC1155_TOKEN_ON_SCHAIN]";
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let txOpts = {
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    await ima.schain.addERC1155TokenByOwner(erc1155OnMainnet, erc1155OnSchain, txOpts);
  }