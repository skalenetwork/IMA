let fs = require("fs");

const gasMultiplierParameter = 'gas_multiplier';
const argv = require('minimist')(process.argv.slice(2), {string: [gasMultiplierParameter]});
const gasMultiplier = argv[gasMultiplierParameter] === undefined ? 1 : Number(argv[gasMultiplierParameter])

let MessageProxy = artifacts.require("./MessageProxy.sol");
let TokenManager = artifacts.require("./TokenManager.sol");
let LockAndDataForSchain = artifacts.require("./LockAndDataForSchain.sol");
let EthERC20 = artifacts.require("./EthERC20.sol");
let ERC20ModuleForSchain = artifacts.require("./ERC20ModuleForSchain.sol");
let LockAndDataForSchainERC20 = artifacts.require("./LockAndDataForSchainERC20.sol");
let ERC721ModuleForSchain = artifacts.require("./ERC721ModuleForSchain.sol");
let LockAndDataForSchainERC721 = artifacts.require("./LockAndDataForSchainERC721.sol");
let TokenFactory = artifacts.require("./TokenFactory.sol");

let networks = require("../truffle-config.js");
let proxyMainnet = require("../data/proxyMainnet.json");

async function deploy(deployer, network) {
    
    if (network != "test" && network != "coverage") {
        if (network != "schain") {
            console.log("Please use network with name 'schain'");
            process.exit(0);
        }
        if (networks['networks'][network]['name'] == undefined || networks['networks'][network]['name'] == "") {
            console.log("Please set SCHAIN_NAME to .env file");
            process.exit(0);
        }
    } 
    let schainName = networks['networks'][network]['name'];
    await deployer.deploy(MessageProxy, schainName, {gas: 8000000}).then(async function() {
        return await deployer.deploy(LockAndDataForSchain, {gas: 8000000});
    }).then(async function(inst) {
        await deployer.deploy(TokenManager, schainName, MessageProxy.address, inst.address, {gas: 8000000 * gasMultiplier});
        await deployer.deploy(EthERC20, {gas: 8000000 * gasMultiplier}).then(async function(EthERC20Inst) {
            await EthERC20Inst.transferOwnership(inst.address, {gas: 200000});
        });
        await inst.setContract("TokenManager", TokenManager.address);
        await inst.setEthERC20Address(EthERC20.address);
        await deployer.deploy(ERC20ModuleForSchain, inst.address, {gas: 8000000 * gasMultiplier});
        await inst.setContract("ERC20Module", ERC20ModuleForSchain.address);
        await deployer.deploy(LockAndDataForSchainERC20, inst.address, {gas: 8000000 * gasMultiplier});
        await inst.setContract("LockAndDataERC20", LockAndDataForSchainERC20.address);
        await deployer.deploy(ERC721ModuleForSchain, inst.address, {gas: 8000000 * gasMultiplier});
        await inst.setContract("ERC721Module", ERC721ModuleForSchain.address);
        await deployer.deploy(LockAndDataForSchainERC721, inst.address, {gas: 8000000 * gasMultiplier});
        await inst.setContract("LockAndDataERC721", LockAndDataForSchainERC721.address);
        await deployer.deploy(TokenFactory, inst.address, {gas: 8000000 * gasMultiplier});
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
        lock_and_data_for_schain_erc721_address: LockAndDataForSchainERC721.address,
        lock_and_data_for_schain_erc721_abi: LockAndDataForSchainERC721.abi,
        erc721_module_for_schain_address: ERC721ModuleForSchain.address,
        erc721_module_for_schain_abi: ERC721ModuleForSchain.abi,
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
    });

    console.log("Deployment done!");
}

module.exports = deploy;