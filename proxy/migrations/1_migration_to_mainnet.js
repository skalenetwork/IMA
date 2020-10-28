// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file 1_migration_to_mainnet.js
 * @copyright SKALE Labs 2019-Present
 */

let fs = require("fs");
const fsPromises = fs.promises;

let networks = require("../truffle-config.js");
let jsonData = require("../data/skaleManagerComponents.json");

const gasMultiplierParameter = 'gas_multiplier';
const argv = require('minimist')(process.argv.slice(2), {string: [gasMultiplierParameter]});
const gasMultiplier = argv[gasMultiplierParameter] === undefined ? 1 : Number(argv[gasMultiplierParameter])

const { scripts, ConfigManager } = require('@openzeppelin/cli');
const { add, push, create } = scripts;

let MessageProxyForMainnet = artifacts.require("./MessageProxyForMainnet.sol");
let DepositBox = artifacts.require("./DepositBox.sol");
let LockAndDataForMainnet = artifacts.require("./LockAndDataForMainnet.sol");
let ERC20ModuleForMainnet = artifacts.require("./ERC20ModuleForMainnet.sol");
let LockAndDataForMainnetERC20 = artifacts.require("./LockAndDataForMainnetERC20.sol");
let ERC721ModuleForMainnet = artifacts.require("./ERC721ModuleForMainnet.sol");
let LockAndDataForMainnetERC721 = artifacts.require("./LockAndDataForMainnetERC721.sol");

let gasLimit = 8000000;

async function deploy(deployer, networkName, accounts) {

    const deployAccount = accounts[0];
    const options = await ConfigManager.initNetworkConfiguration({ network: networkName, from: deployAccount });

    const contracts = [
        "LockAndDataForMainnet", // must be in first position

        "MessageProxyForMainnet", // must be above MessageProxy
        "DepositBox", // must be below DepositBox
        "ERC20ModuleForMainnet",
        "LockAndDataForMainnetERC20",
        "ERC721ModuleForMainnet",
        "LockAndDataForMainnetERC721"
    ]

    contractsData = [];
    for (const contract of contracts) {
        contractsData.push({name: contract, alias: contract});
    }

    add({ contractsData: contractsData });

    await push(options);

    const deployed = new Map();
    let lockAndDataForMainnet;
    for (const contractName of contracts) {
        let contract;
        if (contractName == "LockAndDataForMainnet") {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: 'initialize', methodArgs: [] }, options));
            lockAndDataForMainnet = contract;
            console.log("lockAndDataForMainnet address:", contract.address);
        } else if (["MessageProxyForMainnet"].includes(contractName)) {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: 'initialize', methodArgs: ["Mainnet", jsonData.contract_manager_address] }, options));
        } else if (["DepositBox"].includes(contractName)) {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: 'initialize', methodArgs: [deployed.get("MessageProxyForMainnet").address, lockAndDataForMainnet.address] }, options));
        } else {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: 'initialize', methodArgs: [lockAndDataForMainnet.address] }, options));
        }
        deployed.set(contractName, contract);
    }

    console.log("Register contracts");
    
    for (const contract of contracts) {
        const address = deployed.get(contract).address;
        await lockAndDataForMainnet.methods.setContract(contract, address).send({from: deployAccount}).then(function(res) {
            console.log("Contract", contract, "with address", address, "is registered in Contract Manager");
        });
    }

    console.log('Deploy done, writing results...');

    let jsonObject = { };
    for (const contractName of contracts) {
        propertyName = contractName.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
        jsonObject[propertyName + "_address"] = deployed.get(contractName).address;
        jsonObject[propertyName + "_abi"] = artifacts.require("./" + contractName).abi;
    }

    await fsPromises.writeFile(`data/proxyMainnet.json`, JSON.stringify(jsonObject));
    console.log(`Done, check proxyMainnet.json file in data folder.`);

    // await deployer.deploy(MessageProxyForMainnet, "Mainnet", jsonData.contract_manager_address /*"0x0000000000000000000000000000000000000000"*/, {gas: gasLimit}).then(async function() {
    //     return await deployer.deploy(LockAndDataForMainnet, {gas: gasLimit});
    // }).then(async function(inst) {
    //     await deployer.deploy(DepositBox, MessageProxyForMainnet.address, inst.address, {gas: gasLimit * gasMultiplier});
    //     await inst.setContract("DepositBox", DepositBox.address);
    //     await deployer.deploy(ERC20ModuleForMainnet, inst.address, {gas: gasLimit * gasMultiplier});
    //     await inst.setContract("ERC20Module", ERC20ModuleForMainnet.address);
    //     await deployer.deploy(LockAndDataForMainnetERC20, inst.address, {gas: gasLimit * gasMultiplier});
    //     await inst.setContract("LockAndDataERC20", LockAndDataForMainnetERC20.address);
    //     await deployer.deploy(ERC721ModuleForMainnet, inst.address, {gas: gasLimit * gasMultiplier});
    //     await inst.setContract("ERC721Module", ERC721ModuleForMainnet.address);
    //     await deployer.deploy(LockAndDataForMainnetERC721, inst.address, {gas: gasLimit * gasMultiplier});
    //     await inst.setContract("LockAndDataERC721", LockAndDataForMainnetERC721.address);

    //     let jsonObject = {
    //         lock_and_data_for_mainnet_address: LockAndDataForMainnet.address,
    //         lock_and_data_for_mainnet_abi: LockAndDataForMainnet.abi,
    //         deposit_box_address: DepositBox.address,
    //         deposit_box_abi: DepositBox.abi,
    //         lock_and_data_for_mainnet_erc20_address: LockAndDataForMainnetERC20.address,
    //         lock_and_data_for_mainnet_erc20_abi: LockAndDataForMainnetERC20.abi,
    //         erc20_module_address: ERC20ModuleForMainnet.address,
    //         erc20_module_abi: ERC20ModuleForMainnet.abi,
    //         lock_and_data_for_mainnet_erc721_address: LockAndDataForMainnetERC721.address,
    //         lock_and_data_for_mainnet_erc721_abi: LockAndDataForMainnetERC721.abi,
    //         erc721_module_address: ERC721ModuleForMainnet.address,
    //         erc721_module_abi: ERC721ModuleForMainnet.abi,
    //         message_proxy_mainnet_address: MessageProxyForMainnet.address,
    //         message_proxy_mainnet_abi: MessageProxyForMainnet.abi
    //     }

    //     await fsPromises.writeFile('data/proxyMainnet.json', JSON.stringify(jsonObject));
    //     await sleep(10000);
    //     console.log('Done, check proxyMainnet file in data folder.');
    // });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = deploy;
