// import & init ima-js here

export async function linkERC20TokenOrigin(schain) {
    let erc20OnOrigin = "[ADDRESS_OF_ERC20_TOKEN_ON_ORIGIN]";
    let erc20OnTarget = "[ADDRESS_OF_ERC20_TOKEN_ON_TARGET]";

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC20AddedOrigin = await schain.erc20.getTokenCloneAddress(erc20OnOrigin);
    if (isERC20AddedOrigin === ZERO_ADDRESS) {
        await schain.erc20.addTokenByOwner(
            targetChainName,
            erc20OnOrigin,
            erc20OnTarget,
            opts
        );
    }
}