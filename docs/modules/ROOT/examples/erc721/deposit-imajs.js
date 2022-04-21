// import & init ima-js here

export function initTestTokenContract(ima) {
    // initialize ERC721 contract
    const abiData = require("[ERC721_ABI_ON_ETHEREUM]");
    return new ima.mainnet.web3.eth.Contract(
      abiData.erc721_abi,
      abiData.erc721_address);
}

export function initTestTokenContractSchain(ima) {
    // initialize ERC721 contract
    const abiData = require("[ERC721_ABI_ON_SCHAIN]");
    return new ima.schain.web3.eth.Contract(
      abiData.erc721_abi,
      abiData.erc721_address
    );
}

export async function depositERC721(ima) {
    let tokenName = "[ERC721_TOKEN_NAME";
    let erc721TokenId = "[ID_OF_THE_TOKEN_TO_TRANSFER]";
    let schainName = "[YOUR_SKALE_CHAIN_NAME]";
  
    let mainnetERC721 = initTestTokenContract(ima);
    let schainERC721 = initTestTokenContractSchain(ima);

    ima.addERC721Token(tokenName, mainnetERC721, schainERC721);
  
    let address = "[YOUR_ADDRESS]";
    let privateKey = "[YOUR_PRIVATE_KEY]";
  
    let opts = { // transaction options
      address: address,
      privateKey: privateKey // remove privateKey from txOpts to use Metamask signing
    };
  
    const erc721OwnerMainnet = await ima.mainnet.getERC721OwnerOf(mainnetERC20, erc721TokenId); // get owner on the Mainnet before the transfer
    const erc721OwnerSchain = await ima.schain.getERC721OwnerOf(schainERC20, erc721TokenId); // get owner on the sChain before the transfer
  
    const depositBoxAddress = ima.mainnet.erc721.address;

    if (erc721OwnerMainnet != depositBoxAddress) {
        await ima.mainnet.erc721.approve(tokenName, erc721TokenId, opts);
    }
    await ima.depositERC721(schainName, tokenName, erc721TokenId, opts);

    // optional
    await ima.schain.waitERC721OwnerChange(testTokens.schainERC721, erc721TokenId, erc721OwnerSchain);
}