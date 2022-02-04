// import & init ima-js here

export async function makeDeposit(ima) {
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let txOpts = { // transaction options
      value: ima.mainnet.web3.utils.toWei("1", "ether"),
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    await ima.mainnet.depositETHtoSChain(
      schainName,
      txOpts
    );
  }