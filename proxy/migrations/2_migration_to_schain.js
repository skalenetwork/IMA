let fs = require("fs");
let MessageProxy = artifacts.require("./MessageProxy.sol");
let TokenManager = artifacts.require("./TokenManager.sol");
let LockAndDataForSchain = artifacts.require("./LockAndDataForSchain.sol");
let EthERC20 = artifacts.require("./EthERC20.sol");

let networks = require("../truffle-config.js");
let proxyMainnet = require("../data/proxyMainnet.json");

async function deploy(deployer, network) {
    
    if (network != "schain") {
        console.log("Please use network with name 'schain'");
        process.exit(0);
    }
    if (networks['networks'][network]['name'] == undefined || networks['networks'][network]['name'] == "") {
        console.log("Please set SCHAIN_NAME to .env file");
        process.exit(0);
    }
    let schainName = networks['networks'][network]['name'];
    await deployer.deploy(MessageProxy, schainName, {gas: 8000000}).then(async function() {
        return await deployer.deploy(LockAndDataForSchain, {gas: 8000000});
    }).then(async function(inst) {
        await deployer.deploy(TokenManager, schainName, MessageProxy.address, inst.address, {gas: 8000000});
        await deployer.deploy(EthERC20, {gas: 8000000});
        await inst.setContract("TokenManager", TokenManager.address);
        await inst.setEthERC20Address(EthERC20.address);
    });

    let jsonObject = {
        lock_and_data_for_schain_address: LockAndDataForSchain.address,
        lock_and_data_for_schain_abi: LockAndDataForSchain.abi,
        eth_erc20_address: EthERC20.address,
        eth_erc20_abi: EthERC20.abi,
        token_manager_address: TokenManager.address,
        token_manager_abi: TokenManager.abi,
        message_proxy_chain_address: MessageProxy.address,
        message_proxy_chain_abi: MessageProxy.abi
    }

    await fs.writeFile('data/proxySchain.json', JSON.stringify(jsonObject), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log('Done, check proxySchain file in data folder.');
        process.exit(0);
    });

    console.log("Deployment done!");
}

module.exports = deploy;