// import & init ima-js here

export async function linkERC721TokenSchain(ima) {
    let erc721OnMainnet = "[ADDRESS_OF_ERC721_TOKEN_ON_MAINNET]";
    let erc721OnSchain = "[ADDRESS_OF_ERC721_TOKEN_ON_SCHAIN]";

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    await ima.schain.erc721.addTokenByOwner(erc721OnMainnet, erc721OnSchain, opts);
}