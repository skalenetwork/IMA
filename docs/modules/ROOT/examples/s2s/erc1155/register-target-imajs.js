// import & init ima-js here

export async function linkERC1155TokenOrigin(ima) {
    let erc1155OnOrigin = "[ADDRESS_OF_ERC1155_TOKEN_ON_ORIGIN]";
    let erc1155OnTarget = "[ADDRESS_OF_ERC1155_TOKEN_ON_TARGET]";

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC20AddedTarget = await ima.schain.erc20.isTokenAdded(erc20OnTarget);
    if (isERC1155AddedTarget === ZERO_ADDRESS) {
        await ima.schain.erc1155.addTokenByOwner(
            originChainName,
            erc20OnOrigin,
            erc20OnTarget,
            opts
        );
    }
}
