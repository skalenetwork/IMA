// import & init ima-js here

export async function linkERC20TokenSchain(ima) {
    let erc20OnMainnet = "[ADDRESS_OF_ERC20_TOKEN_ON_MAINNET]";
    let erc20OnSchain = "[ADDRESS_OF_ERC20_TOKEN_ON_SCHAIN]";

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let txOpts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC20AddedSchain = await this.schain.isERC20Added(erc20OnMainnet);
    if (isERC20AddedSchain === ZERO_ADDRESS) { // check if token is already added
        await this.schain.addERC20TokenByOwner(erc20OnMainnet, erc20OnSchain, txOpts);
    }
}