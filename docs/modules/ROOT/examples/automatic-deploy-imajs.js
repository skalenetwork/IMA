// import & init ima-js here

export async function enableAutomaticDeployERC20(ima) {
    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let txOpts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    await ima.schain.enableAutomaticDeploy("ERC20", txOpts);
}