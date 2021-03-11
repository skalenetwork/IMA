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

const gasLimit = 8000000;

async function deploy( deployer, network ) {

    await deployer.deploy( ContractManager, { gas: gasLimit } ).then( async function( instCM ) {
        await deployer.deploy( Schains, { gas: gasLimit } );
        instCM.setContractsAddress( "Schains", Schains.address );
        await deployer.deploy( SchainsInternal, { gas: gasLimit } );
        instCM.setContractsAddress( "SchainsInternal", SchainsInternal.address );
        await deployer.deploy( Wallets, { gas: gasLimit } );
        instCM.setContractsAddress( "Wallets", Wallets.address );

        const jsonObject = {
            contract_manager_address: ContractManager.address
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
