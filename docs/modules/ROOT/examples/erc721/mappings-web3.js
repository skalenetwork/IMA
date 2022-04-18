const Web3 = require('web3');

let rinkebyABIs = "[YOUR_SKALE_ABIs_ON_RINKEBY]";
let rinkebyERC721ABI = "[YOUR_ERC721_ABI_ON_RINKEBY]";

let rinkeby = "[RINKEBY_ENDPOINT]";
let schainName = "[YOUR_SKALE_CHAIN_NAME]";

const depositBoxAddress = rinkebyABIs.deposit_box_erc721_address;
const depositBoxABI = rinkebyABIs.deposit_box_erc721_abi;

const web3ForMainnet = new Web3(rinkeby);

let depositBox = new web3ForMainnet.eth.Contract(
  depositBoxABI,
  depositBoxAddress
);

let mappedNumber = depositBox.methods
  .getSchainToAllERC721Length(
    schainName
  )
  .call();

let mappedArray = Array();
for (let i = 0; i < (mappedNumber + 9) / 10; i++) {
    let nextIndex = ((i + 1) * 10 < mappedNumber ? (I + 1) * 10 : mappedNumber);
    let mappedArrayPart = depositBox.methods.getSchainToAllERC721(schainName, i * 10, nextIndex).call();
    mappedArrayPart.forEach( (address) => { mappedArray.push(address) });
}
