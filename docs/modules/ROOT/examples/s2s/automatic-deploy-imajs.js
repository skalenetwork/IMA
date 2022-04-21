// import & init ima-js here

export async function enableAutomaticDeployERC20(ima) {
    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let txOpts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    let automaticDeploy;

    // erc20
    automaticDeploy = await ima.schain.erc20.automaticDeploy();
    await ima.schain.erc20.enableAutomaticDeploy(txOpts);
    await ima.schain.erc20.disableAutomaticDeploy(txOpts);

    // erc721
    automaticDeploy = await ima.schain.erc721.automaticDeploy();
    await ima.schain.erc721.enableAutomaticDeploy(txOpts);
    await ima.schain.erc721.disableAutomaticDeploy(txOpts);

    // erc1155
    automaticDeploy = await ima.schain.erc1155.automaticDeploy();
    await ima.schain.erc1155.enableAutomaticDeploy(txOpts);
    await ima.schain.erc1155.disableAutomaticDeploy(txOpts);

}