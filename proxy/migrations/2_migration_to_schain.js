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
 * @file 2_migration_to_schain.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );
const path = require( "path" );
require( "dotenv" ).config();
const fsPromises = fs.promises;

const gasMultiplierParameter = "gas_multiplier";
const argv = require( "minimist" )( process.argv.slice( 2 ), { string: [ gasMultiplierParameter ] } );
const gasMultiplier = argv[gasMultiplierParameter] === undefined ? 1 : Number( argv[gasMultiplierParameter] );

const MessageProxyForSchain = artifacts.require( "./MessageProxyForSchain.sol" );
const MessageProxyForSchainWithoutSignatures = artifacts.require( "./MessageProxyForSchainWithoutSignature.sol" );
const TokenManager = artifacts.require( "./TokenManager.sol" );
const LockAndDataForSchain = artifacts.require( "./LockAndDataForSchain.sol" );
const EthERC20 = artifacts.require( "./EthERC20.sol" );
const ERC20ModuleForSchain = artifacts.require( "./ERC20ModuleForSchain.sol" );
const LockAndDataForSchainERC20 = artifacts.require( "./LockAndDataForSchainERC20.sol" );
const ERC721ModuleForSchain = artifacts.require( "./ERC721ModuleForSchain.sol" );
const LockAndDataForSchainERC721 = artifacts.require( "./LockAndDataForSchainERC721.sol" );
const TokenFactory = artifacts.require( "./TokenFactory.sol" );

const networks = require( "../truffle-config.js" );
// const proxyMainnet = require( "../data/proxyMainnet.json" );
const gasLimit = 8000000;

async function deploy( deployer, network ) {

    if( network == "test" || network == "coverage" ) {
        // skip this part of deployment if we run tests
        return;
    }

    if( process.env.CHAIN_NAME_SCHAIN == undefined || process.env.CHAIN_NAME_SCHAIN == "" ) {
        console.log( network );
        console.log( networks.networks[network] );
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }
    const schainName = process.env.CHAIN_NAME_SCHAIN;
    let messageProxy = MessageProxyForSchain;
    if( process.env.NO_SIGNATURES === "true" ) {
        console.log( "Deploy IMA without signature verification" );
        messageProxy = MessageProxyForSchainWithoutSignatures;
    }
    await deployer.deploy( messageProxy, schainName, { gas: gasLimit } ).then( async function() {
        return await deployer.deploy( LockAndDataForSchain, { gas: gasLimit } );
    } ).then( async function( inst ) {
        await inst.setContract( "MessageProxy", messageProxy.address );
        await deployer.deploy( TokenManager, schainName, inst.address, { gas: gasLimit * gasMultiplier } );
        await deployer.deploy( EthERC20, { gas: gasLimit * gasMultiplier } ).then( async function( EthERC20Inst ) {
            await EthERC20Inst.transferOwnership( inst.address, { gas: gasLimit } );
        } );
        await inst.setContract( "TokenManager", TokenManager.address );
        await inst.setEthErc20Address( EthERC20.address );
        await deployer.deploy( ERC20ModuleForSchain, inst.address, { gas: gasLimit * gasMultiplier } );
        await inst.setContract( "ERC20Module", ERC20ModuleForSchain.address );
        await deployer.deploy( LockAndDataForSchainERC20, inst.address, { gas: gasLimit * gasMultiplier } );
        await inst.setContract( "LockAndDataERC20", LockAndDataForSchainERC20.address );
        await deployer.deploy( ERC721ModuleForSchain, inst.address, { gas: gasLimit * gasMultiplier } );
        await inst.setContract( "ERC721Module", ERC721ModuleForSchain.address );
        await deployer.deploy( LockAndDataForSchainERC721, inst.address, { gas: gasLimit * gasMultiplier } );
        await inst.setContract( "LockAndDataERC721", LockAndDataForSchainERC721.address );
        await deployer.deploy( TokenFactory, inst.address, { gas: gasLimit * gasMultiplier } );
        await inst.setContract( "TokenFactory", TokenFactory.address );

        const strPathToBuildDir = path.join( __dirname, "../build/contracts" );
        const strPathToERC20OnChainJSON = path.join( strPathToBuildDir, "ERC20OnChain.json" );
        const strPathToERC721OnChainJSON = path.join( strPathToBuildDir, "ERC721OnChain.json" );
        console.log( "Loading auto-instantiated token ERC20OnChain..." );
        const joBuiltERC20OnChain = JSON.parse( fs.readFileSync( strPathToERC20OnChainJSON, "utf8" ) );
        console.log( "Loading auto-instantiated token ERC20OnChain..." );
        const joBuiltERC721OnChain = JSON.parse( fs.readFileSync( strPathToERC721OnChainJSON, "utf8" ) );
        console.log( "Done loading auto-instantiated tokens." );
        if( ! ( "abi" in joBuiltERC20OnChain ) || ( ! ( joBuiltERC20OnChain.abi ) ) || typeof joBuiltERC20OnChain.abi != "object" )
            throw new Error( "ABI is not found in \"" + strPathToERC20OnChainJSON + "\"" );
        if( ! ( "abi" in joBuiltERC721OnChain ) || ( ! ( joBuiltERC721OnChain.abi ) ) || typeof joBuiltERC721OnChain.abi != "object" )
            throw new Error( "ABI is not found in \"" + strPathToERC721OnChainJSON + "\"" );

        const jsonObject = {
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
            // erc721_on_chain_address: ERC721OnChain.address,
            // erc721_on_chain_abi: ERC721OnChain.abi,
            message_proxy_chain_address: messageProxy.address,
            message_proxy_chain_abi: messageProxy.abi,
            //
            ERC20OnChain_abi: joBuiltERC20OnChain.abi,
            ERC721OnChain_abi: joBuiltERC721OnChain.abi
        };

        const jsonObject2 = {
            lock_and_data_for_schain_address: LockAndDataForSchain.address,
            lock_and_data_for_schain_bytecode: LockAndDataForSchain.bytecode,
            eth_erc20_address: EthERC20.address,
            eth_erc20_bytecode: EthERC20.bytecode,
            token_manager_address: TokenManager.address,
            token_manager_bytecode: TokenManager.bytecode,
            lock_and_data_for_schain_erc20_address: LockAndDataForSchainERC20.address,
            lock_and_data_for_schain_erc20_bytecode: LockAndDataForSchainERC20.bytecode,
            erc20_module_for_schain_address: ERC20ModuleForSchain.address,
            erc20_module_for_schain_bytecode: ERC20ModuleForSchain.bytecode,
            lock_and_data_for_schain_erc721_address: LockAndDataForSchainERC721.address,
            lock_and_data_for_schain_erc721_bytecode: LockAndDataForSchainERC721.bytecode,
            erc721_module_for_schain_address: ERC721ModuleForSchain.address,
            erc721_module_for_schain_bytecode: ERC721ModuleForSchain.bytecode,
            token_factory_address: TokenFactory.address,
            token_factory_bytecode: TokenFactory.bytecode,
            // erc721_on_chain_address: ERC721OnChain.address,
            // erc721_on_chain_bytecode: ERC721OnChain.bytecode,
            message_proxy_chain_address: messageProxy.address,
            message_proxy_chain_bytecode: messageProxy.bytecode
        };

        await fsPromises.writeFile( `data/proxySchain_${schainName}.json`, JSON.stringify( jsonObject ) );
        await fsPromises.writeFile( `data/proxySchain_${schainName}_bytecode.json`, JSON.stringify( jsonObject2 ) );
        await sleep( 10000 );
        console.log( `Done, check proxySchain_${schainName}.json file in data folder.` );
    } );
}

function sleep( ms ) {
    return new Promise( resolve => setTimeout( resolve, ms ) );
}

module.exports = deploy;
