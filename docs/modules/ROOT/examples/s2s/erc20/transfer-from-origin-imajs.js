// import & init ima-js here

export function initTestTokenContractSchain(schain) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_CHAIN]");
    return new schain.web3.eth.Contract(
        abiData.erc20_abi,
        abiData.erc20_address);
}


export async function transfer(schain) {
    let tokenName = "[TOKEN_NAME]";
    let schainERC20 = initTestTokenContractSchain(imaschain);

    let address = "YOUR_ADDRESS";
    let privateKey = "YOUR_PRIVATE_KEY";

    let amount = "[AMOUNT_IN_WEI]";

    let opts = {
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    schain.erc20.addToken(tokenName, schainERC20);

    await schain.erc20.approve(erc20Name, amount, opts);
    await schain.erc20.transferToSchain(
        targetSchainName,
        schainERC20.address,
        amount,
        opts
    );
}
