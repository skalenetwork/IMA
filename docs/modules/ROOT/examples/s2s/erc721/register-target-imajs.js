// import & init ima-js here

export async function linkERC721TokenOrigin(schain) {
    let erc721OnOrigin = "[ADDRESS_OF_ERC721_TOKEN_ON_ORIGIN]";
    let erc721OnTarget = "[ADDRESS_OF_ERC721_TOKEN_ON_TARGET]";

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC721AddedTarget = await schain.erc721.getTokenCloneAddress(erc721nTarget);
    if (isERC721AddedTarget === ZERO_ADDRESS) {
        await schain.erc721.addTokenByOwner(
            originChainName,
            erc721OnOrigin,
            erc721OnTarget,
            opts
        );
    }
}
