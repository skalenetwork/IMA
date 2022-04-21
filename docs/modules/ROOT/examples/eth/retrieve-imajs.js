// import & init ima-js here

export async function retrieveETH(ima) {
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from opts to use Metamask signing
    };

    // retrieve all ETH from DepositBox
    await ima.mainnet.eth.getMyEth(opts);
}
