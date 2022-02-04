// import & init ima-js here

export async function linkERC20TokenMainnet(ima) {
    let schainName = "YOUR_SKALE_CHAIN_NAME";
    let erc20OnMainnet = "ADDRESS_OF_ERC20_TOKEN_ON_MAINNET";

    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let txOpts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC20AddedMainnet = await ima.mainnet.isERC20Added(schainName, erc20OnMainnet);
    if (!isERC20AddedMainnet) { // check if token is already added
        await ima.mainnet.addERC20TokenByOwner(schainName, erc20OnMainnet, txOpts);
    }
}