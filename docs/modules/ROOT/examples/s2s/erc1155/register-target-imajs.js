// import & init ima-js here

export async function linkERC1155TokenOrigin(schain) {
    let erc1155OnOrigin = "[ADDRESS_OF_ERC1155_TOKEN_ON_ORIGIN]";
    let erc1155OnTarget = "[ADDRESS_OF_ERC1155_TOKEN_ON_TARGET]";

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const isERC1155AddedTarget = await schain.erc1155.getTokenCloneAddress(erc1155OnTarget);
    if (isERC1155AddedTarget === ZERO_ADDRESS) {
        await schain.erc1155.addTokenByOwner(
            originChainName,
            erc1155OnOrigin,
            erc1155OnTarget,
            opts
        );
    }
}
