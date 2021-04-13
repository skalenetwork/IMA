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
 * @file 3_migration_skale_manager_components.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );
const fsPromises = fs.promises;

const ContractManager = artifacts.require( "./ContractManager" );
const Schains = artifacts.require( "./Schains" );
const SchainsInternal = artifacts.require( "./SchainsInternal" );
const Wallets = artifacts.require( "./Wallets" );
const KeyStorage = artifacts.require( "./KeyStorage" );
const SkaleVerifierMock = artifacts.require( "./SkaleVerifierMock" );
const Nodes = artifacts.require( "./Nodes" );

const gasLimit = 8000000;

const BLSPublicKey = {
    x: {
        a: "8276253263131369565695687329790911140957927205765534740198480597854608202714",
        b: "12500085126843048684532885473768850586094133366876833840698567603558300429943"
    },
    y: {
        a: "7025653765868604607777943964159633546920168690664518432704587317074821855333",
        b: "14411459380456065006136894392078433460802915485975038137226267466736619639091"
    }
};

async function deploy( deployer, network ) {

    if( process.env.CHAIN_NAME_SCHAIN == undefined || process.env.CHAIN_NAME_SCHAIN == "" ) {
        console.log( network );
        console.log( networks.networks[network] );
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }

    const schainName = process.env.CHAIN_NAME_SCHAIN;

    await deployer.deploy( ContractManager, { gas: gasLimit } ).then( async function( instCM ) {
        await deployer.deploy( Schains, { gas: gasLimit } ).then( async function( instSchains ) {
            await instSchains.addContractManager( ContractManager.address );
        } );
        instCM.setContractsAddress( "Schains", Schains.address );
        const schainsInternal = await deployer.deploy( SchainsInternal, { gas: gasLimit } );
        instCM.setContractsAddress( "SchainsInternal", SchainsInternal.address );
        const wallets = await deployer.deploy( Wallets, { gas: gasLimit } ).then( async function( instWallets ) {
            await instWallets.addContractManager( ContractManager.address );
            return instWallets;
        } ); ;
        instCM.setContractsAddress( "Wallets", Wallets.address );
        await deployer.deploy( SkaleVerifierMock, { gas: gasLimit } );
        instCM.setContractsAddress( "SkaleVerifier", SkaleVerifierMock.address );
        const keyStorage = await deployer.deploy( KeyStorage, { gas: gasLimit } );
        instCM.setContractsAddress( "KeyStorage", KeyStorage.address );
        await deployer.deploy( Nodes, { gas: gasLimit } );
        instCM.setContractsAddress( "Nodes", Nodes.address );

        // register test schain
        const deployerAddress = deployer.provider.addresses[0];
        await schainsInternal.initializeSchain( schainName, deployerAddress, 1, 1 );
        await keyStorage.setCommonPublicKey( web3.utils.soliditySha3( schainName ), BLSPublicKey );
        await wallets.rechargeSchainWallet( web3.utils.soliditySha3( schainName ), { value: "1000000000000000000" } );

        const jsonObject = {
            contract_manager_address: ContractManager.address,
            contract_manager_abi: ContractManager.abi,
            schains_internal_address: SchainsInternal.address,
            schains_internal_abi: SchainsInternal.abi,
            key_storage_address: KeyStorage.address,
            key_storage_abi: KeyStorage.abi,
            wallets_address: Wallets.address,
            wallets_abi: Wallets.abi
        };

        await fsPromises.writeFile( "data/skaleManagerComponents.json", JSON.stringify( jsonObject ) );
        await sleep( 10000 );
        console.log( "Done, check proxyMainnet file in data folder." );
    } );
}

function sleep( ms ) {
    return new Promise( resolve => setTimeout( resolve, ms ) );
}

module.exports = deploy;
