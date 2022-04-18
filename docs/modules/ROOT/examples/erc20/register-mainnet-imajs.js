// import & init ima-js here

export async function linkERC20TokenMainnet(ima) {
    let chainName = "YOUR_SKALE_CHAIN_NAME";
    let erc20OnMainnet = "ADDRESS_OF_ERC20_TOKEN_ON_MAINNET";

    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC20AddedMainnet = await ima.mainnet.erc20.isTokenAdded(
        chainName,
        erc20OnMainnet
    );
    if (!isERC20AddedMainnet){
        await ima.mainnet.erc20.addTokenByOwner(chainName, erc20OnMainnet, opts);
    }
}