let fs = require("fs");

let MessageProxy = artifacts.require("./MessageProxy.sol");
let DepositBox = artifacts.require("./DepositBox.sol");
let LockAndDataForMainnet = artifacts.require("./LockAndDataForMainnet.sol");
let ERC20ModuleForMainnet = artifacts.require("./ERC20ModuleForMainnet.sol");
let LockAndDataForMainnetERC20 = artifacts.require("./LockAndDataForMainnetERC20.sol");
let ERC721ModuleForMainnet = artifacts.require("./ERC721ModuleForMainnet.sol");
let LockAndDataForMainnetERC721 = artifacts.require("./LockAndDataForMainnetERC721.sol");

async function deploy(deployer) {

    await deployer.deploy(MessageProxy, "Mainnet", {gas: 8000000}).then(async function() {
        return await deployer.deploy(LockAndDataForMainnet, {gas: 8000000});
    }).then(async function(inst) {
        await deployer.deploy(DepositBox, MessageProxy.address, inst.address, {gas: 8000000});
        await inst.setContract("DepositBox", DepositBox.address);
        await deployer.deploy(ERC20ModuleForMainnet, inst.address, {gas: 8000000});
        await inst.setContract("ERC20Module", ERC20ModuleForMainnet.address);
        await deployer.deploy(LockAndDataForMainnetERC20, inst.address, {gas: 8000000});
        await inst.setContract("LockAndDataERC20", LockAndDataForMainnetERC20.address);
        await deployer.deploy(ERC721ModuleForMainnet, inst.address, {gas: 8000000});
        await inst.setContract("ERC721Module", ERC721ModuleForMainnet.address);
        await deployer.deploy(LockAndDataForMainnetERC721, inst.address, {gas: 8000000});
        await inst.setContract("LockAndDataERC721", LockAndDataForMainnetERC721.address);
    });

    let jsonObject = {
        lock_and_data_for_mainnet_address: LockAndDataForMainnet.address,
        lock_and_data_for_mainnet_abi: LockAndDataForMainnet.abi,
        deposit_box_address: DepositBox.address,
        deposit_box_abi: DepositBox.abi,
        lock_and_data_for_mainnet_erc20_address: LockAndDataForMainnetERC20.address,
        lock_and_data_for_mainnet_erc20_abi: LockAndDataForMainnetERC20.abi,
        erc20_module_address: ERC20ModuleForMainnet.address,
        erc20_module_abi: ERC20ModuleForMainnet.abi,
        lock_and_data_for_mainnet_erc721_address: LockAndDataForMainnetERC721.address,
        lock_and_data_for_mainnet_erc721_abi: LockAndDataForMainnetERC721.abi,
        erc721_module_address: ERC721ModuleForMainnet.address,
        erc721_module_abi: ERC721ModuleForMainnet.abi,
        message_proxy_mainnet_address: MessageProxy.address,
        message_proxy_mainnet_abi: MessageProxy.abi
    }

    await fs.writeFile('data/proxyMainnet.json', JSON.stringify(jsonObject), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log('Done, check proxyMainnet file in data folder.');
        process.exit(0);
    });
}

module.exports = deploy;