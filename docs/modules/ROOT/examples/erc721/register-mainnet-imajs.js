// import & init ima-js here

export async function linkERC721TokenMainnet(ima) {
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
    const erc721OnMainnet = "[ADDRESS_OF_ERC721_ON_MAINNET]";
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let opts = {
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    await mainnet.erc721.addTokenByOwner(schainName, erc721OnMainnet, opts);
  }