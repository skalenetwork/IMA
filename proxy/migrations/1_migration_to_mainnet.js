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

const fs = require( "fs" );
const fsPromises = fs.promises;

const Web3 = require( "web3" );

const configFile = require( "../truffle-config.js" );
const jsonData = require( "../data/skaleManagerComponents.json" );

const { scripts, ConfigManager } = require( "@openzeppelin/cli" );
const { add, push, create } = scripts;

async function deploy( deployer, networkName, accounts ) {

    const deployAccount = accounts[0];
    const options = await ConfigManager.initNetworkConfiguration( { network: networkName, from: deployAccount } );

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
    for( const contractName of contracts ) {
        let contract;
        if( contractName == "LockAndDataForMainnet" ) {
            contract = await create( Object.assign( { contractAlias: contractName, methodName: "initialize", methodArgs: [] }, options ) );
            lockAndDataForMainnet = contract;
            console.log( "lockAndDataForMainnet address:", contract.address );
        } else
            contract = await create( Object.assign( { contractAlias: contractName, methodName: "initialize", methodArgs: [ lockAndDataForMainnet.address ] }, options ) );

        deployed.set( contractName, contract );
    }
    console.log( "Register contracts" );

    for( const contract of contracts ) {
        const address = deployed.get( contract ).address;
        let registerName = "";
        for( const part of contract.split( "ForMainnet" ) )
            registerName += part;

        await lockAndDataForMainnet.methods.setContract( registerName, address ).send( { from: deployAccount } ).then( function( res ) {
            console.log( "Contract", registerName, "with address", address, "is registered in Contract Manager" );
        } );
    }
    let web3 = null;
    if( jsonData.contract_manager_address !== null && jsonData.contract_manager_address !== "" && jsonData.contract_manager_address !== "0x0000000000000000000000000000000000000000" ) {
        if( configFile.networks[networkName].host !== "" && configFile.networks[networkName].host !== undefined && configFile.networks[networkName].port !== "" && configFile.networks[networkName].port !== undefined )
            web3 = new Web3( new Web3.providers.HttpProvider( "http://" + configFile.networks[networkName].host + ":" + configFile.networks[networkName].port ) );
        else if( configFile.networks[networkName].provider !== "" && configFile.networks[networkName].provider !== undefined )
            web3 = new Web3( configFile.networks[networkName].provider() );
    }
    if( web3 && await web3.eth.getCode( jsonData.contract_manager_address ) !== "0x" ) {
        await lockAndDataForMainnet.methods.setContract( "ContractManagerForSkaleManager", jsonData.contract_manager_address ).send( { from: deployAccount } ).then( function( res ) {
            console.log( "Contract ContractManagerForSkaleManager with address", jsonData.contract_manager_address, "is registered in Contract Manager" );
        } );
    } else {
        console.log( "\nCheck ../data/skaleManagerComponents.json - unknown Contract Manager from SkaleManager" );
        console.log( "ContractManager from SkaleManager was not registered in IMA!!!\n" );
    }
    console.log( "Deploy done, writing results..." );

    const jsonObject = { };
    for( const contractName of contracts ) {
        if( contractName !== "MessageProxyForMainnet" )
            propertyName = contractName.replace( /([a-z0-9])(?=[A-Z])/g, "$1_" ).toLowerCase();
        else
            propertyName = "message_proxy_mainnet";

        jsonObject[propertyName + "_address"] = deployed.get( contractName ).address;
        jsonObject[propertyName + "_abi"] = artifacts.require( "./" + contractName ).abi;
    }

    await fsPromises.writeFile( "data/proxyMainnet.json", JSON.stringify( jsonObject ) );
    console.log( "Done, check proxyMainnet.json file in data folder." );
}

module.exports = deploy;
