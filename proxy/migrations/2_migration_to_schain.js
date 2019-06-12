let fs = require("fs");
let MessageProxy = artifacts.require("./MessageProxy.sol");
let TokenManager = artifacts.require("./TokenManager.sol");
let LockAndDataForSchain = artifacts.require("./LockAndDataForSchain.sol");
let EthERC20 = artifacts.require("./EthERC20.sol");
let ERC20ModuleForSchain = artifacts.require("./ERC20ModuleForSchain.sol");
let LockAndDataForSchainERC20 = artifacts.require("./LockAndDataForSchainERC20.sol");
let TokenFactory = artifacts.require("./TokenFactory.sol");

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
        await deployer.deploy(EthERC20, {gas: 8000000}).then(async function(EthERC20Inst) {
            await EthERC20Inst.transferOwnership(inst.address, {gas: 200000});
        });
        await inst.setContract("TokenManager", TokenManager.address);
        await inst.setEthERC20Address(EthERC20.address);
        await deployer.deploy(ERC20ModuleForSchain, inst.address, {gas: 8000000});
        await inst.setContract("ERC20Module", ERC20ModuleForSchain.address);
        await deployer.deploy(LockAndDataForSchainERC20, inst.address, {gas: 8000000});
        await inst.setContract("LockAndDataERC20", LockAndDataForSchainERC20.address);
        await deployer.deploy(TokenFactory, inst.address, {gas: 8000000});
        await inst.setContract("TokenFactory", TokenFactory.address);
    });

    let jsonObject = {
        lock_and_data_for_schain_address: LockAndDataForSchain.address,
        lock_and_data_for_schain_abi: LockAndDataForSchain.abi,
        eth_erc20_address: EthERC20.address,
        eth_erc20_abi: EthERC20.abi,
        token_manager_address: TokenManager.address,
        token_manager_abi: TokenManager.abi,
        lock_and_data_for_schain_erc20_address: LockAndDataForSchainERC20.address,
        lock_and_data_for_schain_erc20_abi: LockAndDataForSchainERC20.abi,
        erc20_module_for_schain_address: ERC20ModuleForSchain.address,
        erc20_module_for_schain_abi: ERC20ModuleForSchain.abi,
        token_factory_address: TokenFactory.address,
        token_factory_abi: TokenFactory.abi,
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