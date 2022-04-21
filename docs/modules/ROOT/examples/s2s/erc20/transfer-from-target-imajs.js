export function initTestTokenContractSchain(schain) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_TARGET_CHAIN]");
    return new schain.web3.eth.Contract(
        abiData.erc20_abi,
        abiData.erc20_address);
}


export async function transfer() {
    const schain = new SChain(sChainWeb3, sChainAbi); // target schain

    let tokenName = "[TOKEN_NAME]";
    let schainERC20 = initTestTokenContractSchain(schain);

    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let tokenAddressOriginChain = "[TOKEN_ADDRESS]";

    let amount = "[AMOUNT_IN_WEI]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    schain.erc20.addToken(tokenName, schainERC20);

    await schain.erc20.approve(tokenName, amount, opts);
    await schain.erc20.transferToSchain(
        targetSchainName,
        tokenAddressOriginChain, // KEY DIFFERENCE - you should set address of the token on the origin chain
        amount,
        opts
    );
}
