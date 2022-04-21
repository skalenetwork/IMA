// import & init ima-js here

export async function linkERC1155TokenMainnet(ima) {
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
    const erc1155OnMainnet = "[ADDRESS_OF_ERC1155_ON_MAINNET]";
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let opts = {
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    await mainnet.erc1155.addTokenByOwner(schainName, erc1155OnMainnet, opts);
  }