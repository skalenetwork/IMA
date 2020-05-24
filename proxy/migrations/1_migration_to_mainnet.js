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

let MessageProxyForMainnet = artifacts.require("./MessageProxyForMainnet.sol");
let DepositBox = artifacts.require("./DepositBox.sol");
let LockAndDataForMainnet = artifacts.require("./LockAndDataForMainnet.sol");
let ERC20ModuleForMainnet = artifacts.require("./ERC20ModuleForMainnet.sol");
let LockAndDataForMainnetERC20 = artifacts.require("./LockAndDataForMainnetERC20.sol");
let ERC721ModuleForMainnet = artifacts.require("./ERC721ModuleForMainnet.sol");
let LockAndDataForMainnetERC721 = artifacts.require("./LockAndDataForMainnetERC721.sol");

let gasLimit = 8000000;

async function deploy(deployer, network) {

    await deployer.deploy(MessageProxyForMainnet, "Mainnet", jsonData.contract_manager_address /*"0x0000000000000000000000000000000000000000"*/, {gas: gasLimit}).then(async function() {
        return await deployer.deploy(LockAndDataForMainnet, {gas: gasLimit});
    }).then(async function(inst) {
        await deployer.deploy(DepositBox, MessageProxyForMainnet.address, inst.address, {gas: gasLimit * gasMultiplier});
        await inst.setContract("DepositBox", DepositBox.address);
        await deployer.deploy(ERC20ModuleForMainnet, inst.address, {gas: gasLimit * gasMultiplier});
        await inst.setContract("ERC20Module", ERC20ModuleForMainnet.address);
        await deployer.deploy(LockAndDataForMainnetERC20, inst.address, {gas: gasLimit * gasMultiplier});
        await inst.setContract("LockAndDataERC20", LockAndDataForMainnetERC20.address);
        await deployer.deploy(ERC721ModuleForMainnet, inst.address, {gas: gasLimit * gasMultiplier});
        await inst.setContract("ERC721Module", ERC721ModuleForMainnet.address);
        await deployer.deploy(LockAndDataForMainnetERC721, inst.address, {gas: gasLimit * gasMultiplier});
        await inst.setContract("LockAndDataERC721", LockAndDataForMainnetERC721.address);

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
            message_proxy_mainnet_address: MessageProxyForMainnet.address,
            message_proxy_mainnet_abi: MessageProxyForMainnet.abi
        }

        await fsPromises.writeFile('data/proxyMainnet.json', JSON.stringify(jsonObject));
        await sleep(10000);
        console.log('Done, check proxyMainnet file in data folder.');
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = deploy;
