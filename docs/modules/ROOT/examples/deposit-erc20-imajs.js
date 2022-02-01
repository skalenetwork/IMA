// import & init ima-js here

export function initTestTokenContract(ima) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_ETHEREUM]");
    return new ima.mainnet.web3.eth.Contract(
        abiData.erc20_abi,
        abiData.erc20_address);
}

export async function depositERC20(ima) {
    let tokenName = "[ERC20_TOKEN_NAME";
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
    let amount = "[AMOUNT_IN_WEI]";

    let contractObject = initTestTokenContract(ima);
    ima.mainnet.addERC20Token(tokenName, contractObject);

    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let txOpts = { // transaction options
        address: address,
        privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };

    const balanceSchain = await ima.schain.getERC20Balance(tokenName, address); // get sChain balance before the transfer

    await ima.mainnet.approveERC20Transfers(
        tokenName,
        amount,
        txOpts
    );

    await ima.mainnet.depositERC20(
        schainName,
        tokenName,
        txOpts
    );

    // optional
    await ima.schain.waitERC20BalanceChange(tokenName, address, balanceSchain); // wait for the balance to be changed on the sChain side
}