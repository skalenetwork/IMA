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

let jsonData = require("../data/skaleManagerComponents.json");

const { scripts, ConfigManager } = require("@openzeppelin/cli");
const { add, push, create } = scripts;

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
    ];

    contractsData = [];
    for( const contract of contracts )
        contractsData.push( { name: contract, alias: contract } );

    add( { contractsData: contractsData } );

    await push( options );

    const deployed = new Map();
    let lockAndDataForMainnet;
    for (const contractName of contracts) {
        let contract;
        if (contractName == "LockAndDataForMainnet") {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: "initialize", methodArgs: [] }, options));
            lockAndDataForMainnet = contract;
            console.log("lockAndDataForMainnet address:", contract.address);
        } else if (["MessageProxyForMainnet"].includes(contractName)) {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: "initialize", methodArgs: ["Mainnet", jsonData.contract_manager_address] }, options));
        // } else if (["DepositBox"].includes(contractName)) {
        //     contract = await create(Object.assign({ contractAlias: contractName, methodName: "initialize", methodArgs: [deployed.get("MessageProxyForMainnet").address, lockAndDataForMainnet.address] }, options));
        } else {
            contract = await create(Object.assign({ contractAlias: contractName, methodName: "initialize", methodArgs: [lockAndDataForMainnet.address] }, options));
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

    console.log("Deploy done, writing results...");

    let jsonObject = { };
    for (const contractName of contracts) {
        if (contractName !== "MessageProxyForMainnet") {
            propertyName = contractName.replace(/([a-z0-9])(?=[A-Z])/g, "$1_").toLowerCase();
        } else {
            propertyName = "message_proxy_mainnet"
        }
        jsonObject[propertyName + "_address"] = deployed.get(contractName).address;
        jsonObject[propertyName + "_abi"] = artifacts.require("./" + contractName).abi;
    }

    await fsPromises.writeFile(`data/proxyMainnet.json`, JSON.stringify(jsonObject));
    console.log(`Done, check proxyMainnet.json file in data folder.`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = deploy;
