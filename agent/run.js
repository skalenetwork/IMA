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
 * @file run.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );
// const path = require( "path" );
const child_process = require( "child_process" );

const SCHAIN_DIR = process.env.SCHAIN_DIR;

const LOCAL_WALLET_PATH = process.env.LOCAL_WALLET_PATH;
const ETHEREUM_PROXY_PATH = process.env.ETHEREUM_PROXY_PATH;
const SCHAIN_PROXY_PATH = process.env.SCHAIN_PROXY_PATH;
const CHAIN_NAME_SCHAIN = process.env.SCHAIN_ID;

const URL_W3_S_CHAIN = process.env.URL_W3_S_CHAIN;
const URL_W3_ETHEREUM = process.env.URL_W3_ETHEREUM;

const NODE_NUMBER = process.env.NODE_NUMBER;
const NODES_COUNT = process.env.NODES_COUNT;

const debugInfo = `LOCAL_WALLET_PATH: ${LOCAL_WALLET_PATH},
ETHEREUM_PROXY_PATH: ${ETHEREUM_PROXY_PATH},
SCHAIN_PROXY_PATH: ${SCHAIN_PROXY_PATH},
SCHAIN_DIR: ${SCHAIN_DIR},
CHAIN_NAME_SCHAIN: ${CHAIN_NAME_SCHAIN},
URL_W3_S_CHAIN: ${URL_W3_S_CHAIN},
URL_W3_ETHEREUM: ${URL_W3_ETHEREUM},

NODE_NUMBER: ${NODE_NUMBER},
NODES_COUNT: ${NODES_COUNT},

`;
console.log( debugInfo );

const CHECK_TIMEOUT = 4000;

const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

async function run() {
    console.log( "Initializing IMA..." );
    let sChainAbiFileExists = false;

    while( !sChainAbiFileExists ) {
        console.log( `Waiting for ${SCHAIN_PROXY_PATH} file...` );
        sChainAbiFileExists = fs.existsSync( SCHAIN_PROXY_PATH );

        if( sChainAbiFileExists ) {
            console.log( "File found!" );

            const fileContents = await fs.promises.readFile( LOCAL_WALLET_PATH );
            const localWallet = JSON.parse( fileContents );
            const pk = localWallet.private_key.slice( 2 );

            const baseArgs = `--url-main-net=${URL_W3_ETHEREUM} --url-s-chain=${URL_W3_S_CHAIN} --max-wait-attempts=10 \
            --id-main-net=Mainnet --id-s-chain=${CHAIN_NAME_SCHAIN} --abi-main-net=${ETHEREUM_PROXY_PATH} \
            --node-number=${NODE_NUMBER} --nodes-count=${NODES_COUNT}  \
            --abi-s-chain=${SCHAIN_PROXY_PATH} --key-main-net=${pk} --key-s-chain=${pk} --period 5`;

            const baseCmd = `node ${__dirname}/main.js`;
            // const registerCmd = `${baseCmd} --register ${baseArgs}`;
            const loopCmd = `${baseCmd} --loop ${baseArgs}`;

            // console.log(registerCmd); // todo: rm, tmp!
            console.log( loopCmd ); // todo: rm, tmp!

            // child_process.execSync(
            //   registerCmd,
            //   {stdio: "inherit"}
            // );

            child_process.execSync(
                loopCmd, {
                    stdio: "inherit"
                }
            );
            // TO-DO: start IMA logic!!!
        }
        await sleep( CHECK_TIMEOUT );
    }
}

run();
