let fs = require("fs");
const fsPromises = fs.promises;

let networks = require("../truffle-config.js");

const gasMultiplierParameter = 'gas_multiplier';
const argv = require('minimist')(process.argv.slice(2), {string: [gasMultiplierParameter]});
const gasMultiplier = argv[gasMultiplierParameter] === undefined ? 1 : Number(argv[gasMultiplierParameter])

let ContractManager = artifacts.require("./ContractManager");
let SkaleVerifier = artifacts.require("./SkaleVerifier");

let gasLimit = 8000000;

async function deploy(deployer, network) {

    await deployer.deploy(ContractManager, {gas: gasLimit}).then(async function(instCM) {
        await deployer.deploy(SkaleVerifier, {gas: gasLimit});
        instCM.setContractsAddress("SkaleVerifier", SkaleVerifier.address);
        
        let jsonObject = {
            contract_manager_address: ContractManager.address,
        }

        await fsPromises.writeFile('data/skaleManagerComponents.json', JSON.stringify(jsonObject));
        await sleep(10000);
        console.log('Done, check proxyMainnet file in data folder.');
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = deploy;
