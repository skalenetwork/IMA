// import & init ima-js here

export function initTestTokenContract(ima) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_SCHAIN]");
    return new ima.schain.web3.eth.Contract(
      abiData.erc20_abi,
      abiData.erc20_address);
  }
  
  export async function exit(ima) {
    let tokenName = "[ERC20_TOKEN_NAME]";
    let mainnetERC20TokenAddress = "[ERC20_MAINNET_TOKEN_ADDRESS]";
    let amount = "[AMOUNT_IN_WEI]";
  
    let contractObject = initTestTokenContract(ima);
    ima.schain.addERC20Token(tokenName, contractObject);
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let txOpts = { // transaction options
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    const balanceMainnet = await ima.mainnet.getERC20Balance(tokenName, address); // get Mainnet balance before the transfer
  
    await ima.schain.approveERC20Transfers(
      tokenName,
      "MAX_APPROVAL_IN_WEI",
      txOpts
    );
  
    await ima.schain.withdrawERC20(
      mainnetERC20TokenAddress,
      amount,
      txOpts
    );
  
    // optional
    await ima.mainnet.waitERC20BalanceChange(tokenName, address, balanceMainnet); // wait for the balance to be changed on the Mainnet side
  }