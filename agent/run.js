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

const MAINNET_PROXY_PATH = process.env.MAINNET_PROXY_PATH;
const SCHAIN_PROXY_PATH = process.env.SCHAIN_PROXY_PATH;
const SCHAIN_NAME = process.env.SCHAIN_ID;

const SCHAIN_RPC_URL = process.env.SCHAIN_RPC_URL;
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL;

const NODE_NUMBER = process.env.NODE_NUMBER;
const NODES_COUNT = process.env.NODES_COUNT;

const debugInfo = `MAINNET_PROXY_PATH: ${MAINNET_PROXY_PATH},
SCHAIN_PROXY_PATH: ${SCHAIN_PROXY_PATH},
SCHAIN_DIR: ${SCHAIN_DIR},
SCHAIN_NAME: ${SCHAIN_NAME},
SCHAIN_RPC_URL: ${SCHAIN_RPC_URL},
MAINNET_RPC_URL: ${MAINNET_RPC_URL},

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
            const baseArgs = `--url-main-net=${MAINNET_RPC_URL} --url-s-chain=${SCHAIN_RPC_URL} \
            --id-main-net=Mainnet --id-s-chain=${SCHAIN_NAME} --abi-main-net=${MAINNET_PROXY_PATH} \
            --node-number=${NODE_NUMBER} --nodes-count=${NODES_COUNT}  \
            --abi-s-chain=${SCHAIN_PROXY_PATH} --period 5`;

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
