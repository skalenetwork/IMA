// import & init ima-js here

export function initTestTokenContract(ima) {
    // initialize ERC20 contract
    const abiData = require("[ERC20_ABI_ON_SCHAIN]");
    return new ima.schain.web3.eth.Contract(
      abiData.erc20_abi,
      abiData.erc20_address);
}

export function initTestTokenContractSchain(ima) {
  // initialize ERC20 contract
  const abiData = require("[ERC20_ABI_ON_CHAIN]");
  return new ima.schain.web3.eth.Contract(
      abiData.erc20_abi,
      abiData.erc20_address);
}
 

export async function exit(ima) {
    let erc20Name = "[ERC20_TOKEN_NAME]";
    let amount = "[AMOUNT_IN_WEI]";  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";

    let mainnetERC20 = initTestTokenContract(ima);
    let schainERC20 = initTestTokenContractSchain(ima);

    ima.addERC20Token(erc20Name, mainnetERC20, schainERC20);
  
    let opts = { // transaction options
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    const balanceMainnet = await ima.mainnet.getERC20Balance(mainnetERC20, address); // get Mainnet balance before the transfer
  
    await ima.schain.erc20.approve(erc20Name, amount, opts);
    await ima.withdrawERC20(
      erc20Name,
      amount,
      opts
    );
  
    // optional
    await ima.mainnet.waitERC20BalanceChange(mainnetERC20, address, balanceMainnet); // wait for the balance to be changed on the Mainnet side
  }