export function initTestTokenContractSchain(schain) {
    // initialize ERC1155 contract
    const abiData = require("[ERC1155_ABI_ON_ORIGIN_CHAIN]");
    return new schain.web3.eth.Contract(
        abiData.erc1155_abi,
        abiData.erc1155_address);
}


export async function transfer() {
    const schain = new SChain(sChainWeb3, sChainAbi); // origin schain

    let tokenName = "[TOKEN_NAME]";
    let schainERС1155 = initTestTokenContractSchain(imaschain);

    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let tokenId = "[TOKEN_ID]";
    let amount = "[AMOUNT]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    schain.erc1155.addToken(tokenName, schainERC1155);

    await schain.erc1155.approveAll(tokenName, tokenId, opts);
    await schain.erc1155.transferToSchain(
        targetSchainName,
        schainERС1155.address,
        tokenId,
        amount,
        opts
    );
}
