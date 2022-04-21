// import & init ima-js here

export async function connectSchain(ima) {
    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    await ima.schain.tokenManagerLinker.connectSchain(schainName, opts);
}
