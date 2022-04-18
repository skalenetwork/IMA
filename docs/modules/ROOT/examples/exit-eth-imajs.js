// import & init ima-js here

export async function withdrawETH(ima) {
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let txOpts = {
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
    await ima.schain.eth.withdraw(
      schain.web3.utils.toWei("1", "ether"),
      txOpts
    );
  }
  