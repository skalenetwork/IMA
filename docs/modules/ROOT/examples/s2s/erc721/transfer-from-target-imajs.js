export function initTestTokenContractSchain(schain) {
    // initialize ERC721 contract
    const abiData = require("[ERC721_ABI_ON_TARGET_CHAIN]");
    return new schain.web3.eth.Contract(
        abiData.erc721_abi,
        abiData.erc721_address);
}


export async function transfer() {
    const schain = new SChain(sChainWeb3, sChainAbi); // target schain

    let tokenName = "[TOKEN_NAME]";
    let schainERC721 = initTestTokenContractSchain(schain);

    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let tokenAddressOriginChain = "[TOKEN_ADDRESS]";

    let tokenId = "[TOKEN_ID]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    schain.erc721.addToken(tokenName, schainERC721);

    await schain.erc721.approve(tokenName, amount, opts);
    await schain.erc721.transferToSchain(
        targetSchainName,
        tokenAddressOriginChain, // KEY DIFFERENCE - you should set address of the token on the origin chain
        tokenId,
        opts
    );
}
