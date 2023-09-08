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
 * @file oracle.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as rpcCall from "./rpcCall.mjs";
import numberToBN from "number-to-bn";

import * as sha3Module from "sha3";

const Keccak = sha3Module.Keccak;

export const gConstMinPowResultLimit = 10000;
export const gConstMaxPowResultLimit = 100000;

const gBigNumMinPowResult = numberToBN( gConstMinPowResultLimit );
const gBigNum1 = numberToBN( 1 );
const gBigNum2 = numberToBN( 2 );
const gBigNum256 = numberToBN( 256 );
const gBigNumUpperPart = gBigNum2.pow( gBigNum256 ).sub( gBigNum1 );

const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

function getUtcTimestampString( d ) {
    d = d || new Date(); // use now time if d is not specified
    const nUtcUnixTimeStampWithMilliseconds = d.getTime();
    const t = "" + nUtcUnixTimeStampWithMilliseconds;
    return t;
}

export function findPowNumber( strRequestPart, details, isVerbose ) {
    details = details || log;
    if( isVerbose ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( cc.debug( "source part of request to find " ) +
                cc.sunny( "PoW number" ) + cc.debug( " is " ) + cc.notice( strRequestPart ) +
                "\n" );
        }
    }
    const t = getUtcTimestampString();
    let i = 0, n = 0, s = "";
    if( isVerbose ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( cc.debug( "source " ) + cc.sunny( "t" ) + cc.debug( "=" ) +
                cc.info( t ) + cc.debug( ", this is " ) + cc.sunny( "UTC timestamp" ) + "\n" );
        }
    }
    for( ; i < gConstMaxPowResultLimit; ++ i ) {
        n = "" + i;
        s = "{" + strRequestPart + ",\"time\":" + t + ",\"pow\":" + n + "}";

        const hash = new Keccak( 256 );
        hash.update( s );
        let strHash = hash.digest( "hex" );
        strHash = owaspUtils.ensureStartsWith0x( strHash );

        const f = numberToBN( strHash );
        const r = gBigNumUpperPart.div( f );
        if( r.gt( gBigNumMinPowResult ) ) {
            if( isVerbose ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    details.write( cc.debug( "computed " ) + cc.sunny( "n" ) + cc.debug( "=" ) +
                        cc.info( i ) + cc.debug( ", this is resulting " ) +
                        cc.sunny( "PoW number" ) + "\n" );
                    details.write( cc.debug( "computed " ) + cc.sunny( "f" ) + cc.debug( "=" ) +
                        cc.info( f.toString() ) + cc.debug( "=" ) +
                        cc.info( owaspUtils.ensureStartsWith0x( f.toString( 16 ) ) ) + "\n" );
                    details.write( cc.debug( "computed " ) + cc.sunny( "r" ) + cc.debug( "=" ) +
                        cc.info( "(2**256-1)/f" ) + cc.debug( "=" ) + cc.info( r.toString() ) +
                        cc.debug( "=" ) +
                        cc.info( owaspUtils.ensureStartsWith0x( r.toString( 16 ) ) ) + "\n" );
                    details.write( cc.debug( "computed " ) + cc.sunny( "s" ) + cc.debug( "=" ) +
                        cc.info( s ) + "\n" );
                }
            }
            break;
        }
    }
    return s;
}

export function oracleGetGasPrice( oracleOpts, details ) {
    details = details || log;
    const promiseComplete = new Promise( ( resolve, reject ) => {
        try {
            const url = oracleOpts.url;
            const isVerbose = "isVerbose" in oracleOpts ? oracleOpts.isVerbose : false;
            let isVerboseTraceDetails = "isVerboseTraceDetails" in oracleOpts
                ? oracleOpts.isVerboseTraceDetails : false;
            if( ! ( log.verboseGet() >= log.verboseReversed().trace ) )
                isVerboseTraceDetails = false;
            const callOpts = "callOpts" in oracleOpts ? oracleOpts.callOpts : { };
            const nMillisecondsSleepBefore = "nMillisecondsSleepBefore" in oracleOpts
                ? oracleOpts.nMillisecondsSleepBefore : 1000;
            const nMillisecondsSleepPeriod = "nMillisecondsSleepPeriod" in oracleOpts
                ? oracleOpts.nMillisecondsSleepPeriod : 3000;
            let cntAttempts = "cntAttempts" in oracleOpts ? oracleOpts.cntAttempts : 40;
            if( cntAttempts < 1 )
                cntAttempts = 1;
            rpcCall.create( url, callOpts || { }, async function( joCall, err ) {
                if( err ) {
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                            cc.error( " RPC connection problem for url " ) + cc.u( url ) +
                            cc.error( ", error description: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" );
                    }
                    if( joCall )
                        await joCall.disconnect();
                    reject( new Error(
                        "CRITICAL ORACLE ERROR: RPC connection problem for url \"" +
                        url + "\", error description: " + owaspUtils.extractErrorMessage( err ) ) );
                    return;
                }
                try {
                    const s = findPowNumber(
                        "\"cid\":1000,\"uri\":\"geth://\",\"jsps\":[\"/result\"]," +
                        "\"post\":\"{\\\"jsonrpc\\\":\\\"2.0\\\"," +
                        "\\\"method\\\":\\\"eth_gasPrice\\\",\\\"params\\\":[],\\\"id\\\":1}\"",
                        details,
                        isVerbose
                    );
                    const joIn = { "method": "oracle_submitRequest", "params": [ s ] };
                    if( isVerboseTraceDetails ) {
                        details.write( cc.debug( "RPC call" ) +
                            cc.attention( "oracle_submitRequest" ) + cc.debug( " is " ) +
                            cc.j( joIn ) + "\n" );
                    }
                    await joCall.call( joIn, async function( joIn, joOut, err ) {
                        if( err ) {
                            if( isVerboseTraceDetails ) {
                                details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                                    cc.error( " JSON RPC call(oracle_submitRequest) " ) +
                                    cc.attention( "oracle_submitRequest" ) +
                                    cc.error( " failed, error: " ) +
                                    cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" );
                            }
                            await joCall.disconnect();
                            reject( new Error( "CRITICAL ORACLE ERROR: " +
                                "JSON RPC call(oracle_submitRequest) failed, error: " +
                                owaspUtils.extractErrorMessage( err ) ) );
                            return;
                        }
                        if( isVerboseTraceDetails ) {
                            details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) +
                                cc.attention( "oracle_submitRequest" ) + cc.normal( ")" ) +
                                cc.debug( " result is: " ) + cc.j( joOut ) + "\n" );
                        }
                        if( !( "result" in joOut && typeof joOut.result == "string" &&
                            joOut.result.length > 0 ) ) {
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                                    cc.error( " bad unexpected result" ) +
                                    cc.normal( "(" ) + cc.attention( "oracle_submitRequest" ) +
                                    cc.normal( ")" ) + cc.error( ", error description is" ) +
                                    owaspUtils.extractErrorMessage( err ) + "\n" );
                            }
                            await joCall.disconnect();
                            reject( new Error( "CRITICAL ORACLE ERROR: " +
                                "bad unexpected result(oracle_submitRequest)" ) );
                            return;
                        }
                        for( let idxAttempt = 0; idxAttempt < cntAttempts; ++idxAttempt ) {
                            const nMillisecondsToSleep = ( ! idxAttempt )
                                ? nMillisecondsSleepBefore : nMillisecondsSleepPeriod;
                            if( nMillisecondsToSleep > 0 )
                                await sleep( nMillisecondsToSleep );
                            try {
                                joIn = {
                                    "method": "oracle_checkResult", "params": [ joOut.result ]
                                };
                                if( isVerboseTraceDetails ) {
                                    details.write( cc.debug( "RPC call " ) +
                                        cc.attention( "oracle_checkResult" ) +
                                        cc.debug( " attempt " ) + cc.info( idxAttempt ) +
                                        cc.debug( " of " ) + cc.info( cntAttempts ) +
                                        cc.debug( "..." ) + "\n" );
                                    details.write( cc.debug( "RPC call " ) +
                                        cc.attention( "oracle_checkResult" ) + cc.debug( " is " ) +
                                        cc.j( joIn ) + "\n" );
                                }
                                await joCall.call( joIn, async function( joIn, joOut, err ) {
                                    if( err ) {
                                        if( isVerboseTraceDetails ) {
                                            details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                                                cc.error( " JSON RPC call" ) + cc.debug( "(" ) +
                                                cc.attention( "oracle_checkResult" ) +
                                                cc.normal( ")" ) + cc.error( " failed, error: " ) +
                                                cc.warning( owaspUtils.extractErrorMessage( err )
                                                ) + "\n" );
                                        }
                                        await joCall.disconnect();
                                        return;
                                    }
                                    if( isVerboseTraceDetails ) {
                                        details.write( cc.debug( "RPC call " ) +
                                            cc.attention( "oracle_checkResult" ) +
                                            cc.debug( " result is: " ) + cc.j( joOut ) + "\n" );
                                    }
                                    if( !( "result" in joOut && typeof joOut.result == "string" &&
                                        joOut.result.length > 0 ) ) {
                                        if( isVerboseTraceDetails ) {
                                            details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                                                cc.error( " bad unexpected result in " ) +
                                                cc.attention( "oracle_checkResult" ) + "\n" );
                                        }
                                        await joCall.disconnect();
                                        return;
                                    }
                                    const joResult = JSON.parse( joOut.result );
                                    if( isVerboseTraceDetails ) {
                                        details.write( cc.debug( "RPC call " ) +
                                            cc.attention( "oracle_checkResult" ) +
                                            cc.debug( " parsed " ) + cc.sunny( "result" ) +
                                            cc.debug( " field is: " ) + cc.j( joResult ) + "\n" );
                                    }
                                    const gp = numberToBN( joResult.rslts[0] );
                                    if( isVerbose &&
                                        log.verboseGet() >= log.verboseReversed().information ) {
                                        details.write( cc.success( "success, computed " ) +
                                            cc.sunny( "Gas Price" ) + cc.success( "=" ) +
                                            cc.info( gp.toString() ) + cc.success( "=" ) +
                                            cc.info( owaspUtils.ensureStartsWith0x(
                                                gp.toString( 16 ) ) ) + "\n" );
                                    }
                                    resolve( gp );
                                    await joCall.disconnect();
                                    return;
                                } );
                            } catch ( err ) {
                                if( log.verboseGet() >= log.verboseReversed().critical ) {
                                    details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                                        cc.error( " RPC call " ) +
                                        cc.attention( "oracle_checkResult" ) +
                                        cc.error( " exception is: " ) +
                                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                                        "\n" );
                                }
                                reject( err );
                                await joCall.disconnect();
                                return;
                            }
                        }
                        if( log.verboseGet() >= log.verboseReversed().error ) {
                            details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                                cc.error( " RPC call " ) +
                                cc.attention( "oracle_checkResult" ) +
                                cc.error( " all attempts timed out" ) + "\n" );
                        }
                        reject( new Error(
                            "RPC call(oracle_checkResult) all attempts timed out" ) );
                        await joCall.disconnect();
                        return;
                    } );
                } catch ( err ) {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                            cc.error( " RPC call" ) +
                            cc.attention( "oracle_submitRequest" ) +
                            cc.error( " exception is: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                    }
                    reject( err );
                }
                await joCall.disconnect();
            } );
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                details.write( cc.fatal( "CRITICAL ORACLE ERROR:" ) +
                    cc.error( " RPC call object creation failed, error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
            reject( err );
            return;
        }
    } );
    return promiseComplete;
}
