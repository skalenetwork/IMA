// import & init ima-js here

export function initTestTokenContract(ima) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_ETHEREUM]");
    return new ima.mainnet.web3.eth.Contract(
        abiData.erc20_abi,
        abiData.erc20_address);
}

export function initTestTokenContractSchain(ima) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_CHAIN]");
    return new ima.mainnet.web3.eth.Contract(
        abiData.erc20_abi,
        abiData.erc20_address);
}

export async function depositERC20(ima) {
    let tokenName = "[ERC20_TOKEN_NAME]";
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
    let amount = "[AMOUNT_IN_WEI]";

    let mainnetERC20 = initTestTokenContract(ima);
    let schainERC20 = initTestTokenContractSchain(ima);

    ima.addERC20Token(erc20Name, mainnetERC20, schainERC20);

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let opts = { // transaction options
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const balanceSchain = await ima.schain.getERC20Balance(schainERC20, address); // get sChain balance before the transfer

    await ima.mainnet.erc20.approve(tokenName, amount, opts);
    await ima.depositERC20(
        schainName,
        tokenName,
        amount,
        opts
    );

    // optional
    await ima.schain.waitERC20BalanceChange(schainERC20, address, balanceSchain); // wait for the balance to be changed on the sChain side
}