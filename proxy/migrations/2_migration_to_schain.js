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
require( "dotenv" ).config();
const fsPromises = fs.promises;

const MessageProxyForSchain = artifacts.require( "./MessageProxyForSchain.sol" );
const MessageProxyForSchainWithoutSignatures = artifacts.require( "./MessageProxyForSchainWithoutSignature.sol" );
const TokenManagerEth = artifacts.require( "./TokenManagerEth.sol" );
const TokenManagerERC20 = artifacts.require( "./TokenManagerERC20.sol" );
const TokenManagerERC721 = artifacts.require( "./TokenManagerERC721.sol" );
const EthERC20 = artifacts.require( "./EthERC20.sol" );
const TokenManagerLinker = artifacts.require( "./TokenManagerLinker.sol" );
// const TokenFactoryERC20 = artifacts.require( "./TokenFactoryERC20.sol" );
// const TokenFactoryERC721 = artifacts.require( "./TokenFactoryERC721.sol" );
const ERC20OnChain = artifacts.require( "./ERC20OnChain.sol" );
const ERC721OnChain = artifacts.require( "./ERC721OnChain.sol" );
const SkaleFeatures = artifacts.require( "./SkaleFeaturesMock.sol" );
const CommunityLocker = artifacts.require( "./CommunityLocker.sol" );

const networks = require( "../truffle-config.js" );
const proxyMainnet = require( "../data/proxyMainnet.json" );
const gasLimit = 8000000;

async function deploy( deployer, network, accounts ) {

    // if( network == "test" || network == "coverage" ) {
    //     // skip this part of deployment if we run tests
    //     return;
    // }

    if( process.env.CHAIN_NAME_SCHAIN == undefined || process.env.CHAIN_NAME_SCHAIN == "" ) {
        console.log( network );
        console.log( deployer.networks[network] );
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }
    if( process.env.PRIVATE_KEY_FOR_SCHAIN == undefined || process.env.PRIVATE_KEY_FOR_SCHAIN == "" ) {
        console.log( "Please set PRIVATE_KEY_FOR_SCHAIN to .env file" );
        process.exit( 126 );
    }
    const schainName = process.env.CHAIN_NAME_SCHAIN;
    let messageProxy = MessageProxyForSchain;
    if( process.env.NO_SIGNATURES === "true" ) {
        console.log( "Deploy IMA without signature verification" );
        messageProxy = MessageProxyForSchainWithoutSignatures;
    }
    const contracts = [
        "MessageProxyForSchain",
        "TokenManagerLinker",
        "TokenManagerEth",
        "TokenManagerERC20",
        "TokenManagerERC721",
        "EthERC20",
        "SkaleFeatures",
        "CommunityLocker"
        // "TokenFactoryERC20",
        // "TokenFactoryERC721"
    ];
    const deployed = new Map();
    // check proxyMainnet file (depositBoxEth, depositBoxERC20, depositBoxERC721)
    if(
        proxyMainnet.deposit_box_eth_address == undefined ||
        proxyMainnet.deposit_box_eth_address == "" ||
        proxyMainnet.deposit_box_erc20_address == undefined ||
        proxyMainnet.deposit_box_erc20_address == "" ||
        proxyMainnet.deposit_box_erc721_address == undefined ||
        proxyMainnet.deposit_box_erc721_address == ""
    ) {
        console.log( "Please provide correct abi for mainnet contracts in IMA/proxy/data/proxyMainnet.json" );
        process.exit( 126 );
    }
    const depositBoxEthAddress = proxyMainnet.deposit_box_eth_address;
    const depositBoxERC20Address = proxyMainnet.deposit_box_erc20_address;
    const depositBoxERC721Address = proxyMainnet.deposit_box_erc721_address;

    await deployer.deploy( messageProxy, schainName, { gas: gasLimit } );
    deployed.set( "MessageProxyForSchain", messageProxy.address );

    await deployer.deploy( TokenManagerLinker, messageProxy.address, { gas: gasLimit } );
    deployed.set( "TokenManagerLinker", TokenManagerLinker.address );

    await deployer.deploy( CommunityLocker, schainName, messageProxy.address, TokenManagerLinker.address, { gas: gasLimit } );
    deployed.set( "CommunityLocker", CommunityLocker.address );

    console.log( depositBoxEthAddress );
    
    const tokenManagerEth = await deployer.deploy(
        TokenManagerEth,
        schainName,
        messageProxy.address,
        TokenManagerLinker.address,
        CommunityLocker.address,
        depositBoxEthAddress,
        { gas: gasLimit }
    );
    deployed.set( "TokenManagerEth", TokenManagerEth.address );

    const tokenManagerERC20 = await deployer.deploy(
        TokenManagerERC20,
        schainName,
        messageProxy.address,
        TokenManagerLinker.address,
        CommunityLocker.address,
        depositBoxERC20Address,
        { gas: gasLimit }
    );
    deployed.set( "TokenManagerERC20", TokenManagerERC20.address );

    const tokenManagerERC721 = await deployer.deploy(
        TokenManagerERC721,
        schainName,
        messageProxy.address,
        TokenManagerLinker.address,
        CommunityLocker.address,
        depositBoxERC721Address,
        { gas: gasLimit }
    );
    deployed.set( "TokenManagerERC721", TokenManagerERC721.address );

    await deployer.deploy( EthERC20, TokenManagerEth.address, { gas: gasLimit } );
    const skaleFeatures = await deployer.deploy( SkaleFeatures, { gas: gasLimit } );
    deployed.set( "EthERC20", EthERC20.address );
    // await deployer.deploy( TokenFactoryERC20, "TokenManagerERC20", TokenManagerERC20.address, { gas: gasLimit } );
    // deployed.set("TokenFactoryERC20", TokenFactoryERC20.address);
    // await deployer.deploy( TokenFactoryERC721, "TokenManagerERC721", TokenManagerERC721.address, { gas: gasLimit } );
    // deployed.set("TokenFactoryERC721", TokenFactoryERC721.address);

    console.log( "\nWill set dependencies!\n" );

    await tokenManagerEth.setEthErc20Address( EthERC20.address );
    console.log( "Set EthERC20 address", EthERC20.address, "in TokenManagerEth", TokenManagerEth.address, "completed!\n" );
    // await tokenManagerERC20.setTokenFactory(TokenFactoryERC20.address);
    // console.log("Set TokenFactoryERC20 address", TokenFactoryERC20.address, "in TokenManagerERC20", TokenManagerERC20.address, "completed!\n");
    // await tokenManagerERC721.setTokenFactory(TokenFactoryERC721.address);
    // console.log("Set TokenFactoryERC721 address", TokenFactoryERC721.address, "in TokenManagerERC721", TokenManagerERC721.address, "completed!\n");
    const messageProxyDeployed = await messageProxy.deployed();
    const chainConnectorRole = await messageProxyDeployed.CHAIN_CONNECTOR_ROLE();
    await messageProxyDeployed.grantRole( chainConnectorRole, TokenManagerLinker.address );
    console.log( "Grant CHAIN_CONNECTOR_ROLE to TokenManagerLinker", TokenManagerLinker.address, "in MessageProxyForSchain", messageProxy.address, "completed!\n" );

    const schainOwner = web3.eth.accounts.privateKeyToAccount( process.env.PRIVATE_KEY_FOR_SCHAIN );
    await skaleFeatures.setSchainOwner( schainOwner.address );
    console.log( "Set Schain owner address", schainOwner.address, "in SkaleFeatures", SkaleFeatures.address, "completed!\n" );

    let skaleFeaturesSetterRole = await tokenManagerEth.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerEth.grantRole( skaleFeaturesSetterRole, accounts[0] );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", accounts[0], "in TokenManagerEth", TokenManagerEth.address, "completed!\n" );
    await tokenManagerEth.setSkaleFeaturesAddress( SkaleFeatures.address );
    console.log( "Set SkaleFeatures address", SkaleFeatures.address, "in TokenManagerEth", TokenManagerEth.address, "completed!\n" );

    skaleFeaturesSetterRole = await tokenManagerERC20.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerERC20.grantRole( skaleFeaturesSetterRole, accounts[0] );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", accounts[0], "in TokenManagerERC20", TokenManagerERC20.address, "completed!\n" );
    await tokenManagerERC20.setSkaleFeaturesAddress( SkaleFeatures.address );
    console.log( "Set SkaleFeatures address", SkaleFeatures.address, "in TokenManagerERC20", TokenManagerERC20.address, "completed!\n" );

    skaleFeaturesSetterRole = await tokenManagerERC721.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerERC721.grantRole( skaleFeaturesSetterRole, accounts[0] );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", accounts[0], "in TokenManagerERC721", TokenManagerERC721.address, "completed!\n" );
    await tokenManagerERC721.setSkaleFeaturesAddress( SkaleFeatures.address );
    console.log( "Set SkaleFeatures address", SkaleFeatures.address, "in TokenManagerERC721", TokenManagerERC721.address, "completed!\n" );

    const jsonObjectABI = { };
    const jsonObjectBytecode = { };
    for( const contractName of contracts ) {
        if( contractName !== "MessageProxyForSchain" )
            propertyName = contractName.replace( /([a-z0-9])(?=[A-Z])/g, "$1_" ).toLowerCase();
        else
            propertyName = "message_proxy_chain";

        jsonObjectABI[propertyName + "_address"] = deployed.get( contractName );
        jsonObjectABI[propertyName + "_abi"] = artifacts.require( "./" + contractName ).abi;
        jsonObjectBytecode[propertyName + "_address"] = deployed.get( contractName );
        jsonObjectBytecode[propertyName + "_bytescode"] = artifacts.require( "./" + contractName ).bytecode;
    }
    jsonObjectABI.ERC20OnChain_abi = ERC20OnChain.abi;
    jsonObjectABI.ERC721OnChain_abi = ERC721OnChain.abi;

    await fsPromises.writeFile( `data/proxySchain_${schainName}.json`, JSON.stringify( jsonObjectABI ) );
    await fsPromises.writeFile( `data/proxySchain_${schainName}_bytecode.json`, JSON.stringify( jsonObjectBytecode ) );
    await sleep( 5000 );
    console.log( `Done, check proxySchain_${schainName}.json file in data folder.` );
}

function sleep( ms ) {
    return new Promise( resolve => setTimeout( resolve, ms ) );
}

module.exports = deploy;
