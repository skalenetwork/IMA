// import & init ima-js here

export async function communityPoolUsage() {
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";

    let value = "[recharge value in wei]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    let balance = await mainnet.communityPool.balance(address, schainName);

    await mainnet.communityPool.recharge(
        schainName,
        address,
        {
            value: value,
            address: address,
            privateKey: privateKey
        }
    );

    await mainnet.communityPool.withdraw(
        schainName,
        value,
        opts
    );
}