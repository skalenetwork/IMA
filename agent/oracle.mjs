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

import numberToBN from "number-to-bn";

import { keccak256 } from "js-sha3";
import { cc } from "./utils.mjs";

export const MIN_POW_RESULT = 10000;
export const MAX_POW_NUMBER = 100000;

const g_bnMIN_POW_RESULT = numberToBN( MIN_POW_RESULT );
const g_bn1 = numberToBN( 1 );
const g_bn2 = numberToBN( 2 );
const g_bn256 = numberToBN( 256 );
const g_bnUpperPart = g_bn2.pow( g_bn256 ).sub( g_bn1 );
// log.write( cc.debug( "using " ) + cc.info( "2**256-1" ) + cc.debug( "=" ) + cc.info( "0x" + g_bnUpperPart.toString( 16 ) ) + cc.debug( "=" ) + cc.info( g_bnUpperPart.toString() ) + "\n" );

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

export function oracle_init() {
}

function get_utc_timestamp_string( d ) {
    d = d || new Date(); // use now time if d is not specified
    const nUtcUnixTimeStampWithMilliseconds = d.getTime();
    const t = "" + nUtcUnixTimeStampWithMilliseconds;
    // const t = "" + parseInt( nUtcUnixTimeStampWithMilliseconds / 1000, 10 ) + "000";
    return t;
}

export function find_pow_number( strRequestPart, details, isVerbose ) {
    details = details || log;
    if( isVerbose )
        details.write( cc.debug( "source part of request to find " ) + cc.sunny( "PoW number" ) + cc.debug( " is " ) + cc.notice( strRequestPart ) + "\n" );
    const t = get_utc_timestamp_string();
    let i = 0, n = 0, s = "";
    if( isVerbose )
        details.write( cc.debug( "source " ) + cc.sunny( "t" ) + cc.debug( "=" ) + cc.info( t ) + cc.debug( ", this is " ) + cc.sunny( "UTC timestamp" ) + "\n" );
    for( ; i < MAX_POW_NUMBER; ++ i ) {
        n = "" + i;
        s = "{" + strRequestPart + ",\"time\":" + t + ",\"pow\":" + n + "}";
        const f = numberToBN( "0x" + keccak256( s ) );
        const r = g_bnUpperPart.div( f ); // r = ( 2 ** 256 - 1 ) / f;
        if( r.gt( g_bnMIN_POW_RESULT ) ) { // if( r > MIN_POW_RESULT )
            if( isVerbose ) {
                details.write( cc.debug( "computed " ) + cc.sunny( "n" ) + cc.debug( "=" ) + cc.info( i ) + cc.debug( ", this is resulting " ) + cc.sunny( "PoW number" ) + "\n" );
                details.write( cc.debug( "computed " ) + cc.sunny( "f" ) + cc.debug( "=" ) + cc.info( f.toString() ) + cc.debug( "=" ) + cc.info( "0x" + f.toString( 16 ) ) + "\n" );
                details.write( cc.debug( "computed " ) + cc.sunny( "r" ) + cc.debug( "=" ) + cc.info( "(2**256-1)/f" ) + cc.debug( "=" ) + cc.info( r.toString() ) + cc.debug( "=" ) + cc.info( "0x" + r.toString( 16 ) ) + "\n" );
                details.write( cc.debug( "computed " ) + cc.sunny( "s" ) + cc.debug( "=" ) + cc.info( s ) + "\n" );
            }
            break;
        }
    }
    return s;
}

export function oracle_get_gas_price( oracleOpts, details ) {
    details = details || log;
    const promise_complete = new Promise( ( resolve, reject ) => {
        try {
            const url = oracleOpts.url;
            const isVerbose = "isVerbose" in oracleOpts ? oracleOpts.isVerbose : false;
            const isVerboseTraceDetails = "isVerboseTraceDetails" in oracleOpts ? oracleOpts.isVerboseTraceDetails : false;
            const callOpts = "callOpts" in oracleOpts ? oracleOpts.callOpts : { };
            const nMillisecondsSleepBefore = "nMillisecondsSleepBefore" in oracleOpts ? oracleOpts.nMillisecondsSleepBefore : 1000;
            const nMillisecondsSleepPeriod = "nMillisecondsSleepPeriod" in oracleOpts ? oracleOpts.nMillisecondsSleepPeriod : 3000;
            let cntAttempts = "cntAttempts" in oracleOpts ? oracleOpts.cntAttempts : 40;
            if( cntAttempts < 1 )
                cntAttempts = 1;
            rpcCall.create( url, callOpts || { }, async function( joCall, err ) {
                if( err ) {
                    details.write( cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " RPC connection problem for url " ) + cc.u( url ) + cc.error( ", error description: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
                    if( joCall )
                        await joCall.disconnect();
                    reject( new Error( "CRITICAL ORACLE CALL ERROR: RPC connection problem for url \"" + url + "\", error description: " + owaspUtils.extract_error_message( err ) ) );
                    return;
                }
                try {
                    const s = find_pow_number(
                        "\"cid\":1000,\"uri\":\"geth://\",\"jsps\":[\"/result\"],\"post\":\"{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"method\\\":\\\"eth_gasPrice\\\",\\\"params\\\":[],\\\"id\\\":1}\"",
                        details,
                        isVerbose
                    );
                    const joIn = {
                        method: "oracle_submitRequest",
                        params: [ s ]
                    };
                    if( isVerboseTraceDetails )
                        details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_submitRequest" ) + cc.normal( ")" ) + cc.debug( " is " ) + cc.j( joIn ) + "\n" );
                    await joCall.call( joIn, async function( joIn, joOut, err ) {
                        if( err ) {
                            if( isVerboseTraceDetails )
                                details.write( cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " JSON RPC call" ) + cc.debug( "(" ) + cc.attention( "oracle_submitRequest" ) + cc.normal( ")" ) + cc.error( " failed, error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
                            await joCall.disconnect();
                            reject( new Error( "CRITICAL ORACLE CALL ERROR: JSON RPC call(oracle_submitRequest) failed, error: " + owaspUtils.extract_error_message( err ) ) );
                            return;
                        }
                        if( isVerboseTraceDetails )
                            details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_submitRequest" ) + cc.normal( ")" ) + cc.debug( " result is: " ) + cc.j( joOut ) + "\n" );
                        if( !( "result" in joOut && typeof joOut.result == "string" && joOut.result.length > 0 ) ) {
                            details.write(
                                cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " bad unexpected result" ) +
                                cc.normal( "(" ) + cc.attention( "oracle_submitRequest" ) + cc.normal( ")" ) +
                                + cc.error( ", error description is" ) + waspUtils.extract_error_message( err ) +
                                "\n" );
                            await joCall.disconnect();
                            reject( new Error( "CRITICAL ORACLE CALL ERROR: bad unexpected result(oracle_submitRequest)" ) );
                            return;
                        }
                        for( let idxAttempt = 0; idxAttempt < cntAttempts; ++idxAttempt ) {
                            const nMillisecondsToSleep = ( ! idxAttempt ) ? nMillisecondsSleepBefore : nMillisecondsSleepPeriod;
                            if( nMillisecondsToSleep > 0 )
                                await sleep( nMillisecondsToSleep );
                            try {
                                joIn = {
                                    method: "oracle_checkResult",
                                    params: [ joOut.result ]
                                };
                                if( isVerboseTraceDetails ) {
                                    details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) + cc.debug( " attempt " ) + cc.info( idxAttempt ) + cc.debug( " of " ) + cc.info( cntAttempts ) + cc.debug( "..." ) + "\n" );
                                    details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) + cc.debug( " is " ) + cc.j( joIn ) + "\n" );
                                }
                                await joCall.call( joIn, async function( joIn, joOut, err ) {
                                    if( err ) {
                                        if( isVerboseTraceDetails ) {
                                            details.write(
                                                cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " JSON RPC call" ) +
                                                cc.debug( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) +
                                                cc.error( " failed, error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
                                        }
                                        await joCall.disconnect();
                                        //reject( new Error( "CRITICAL ORACLE CALL ERROR: JSON RPC call(oracle_checkResult) failed, error: " + owaspUtils.extract_error_message( err ) ) );
                                        return;
                                    }
                                    if( isVerboseTraceDetails )
                                        details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) + cc.debug( " result is: " ) + cc.j( joOut ) + "\n" );
                                    if( !( "result" in joOut && typeof joOut.result == "string" && joOut.result.length > 0 ) ) {
                                        if( isVerboseTraceDetails ) {
                                            details.write(
                                                cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " bad unexpected result" ) +
                                                cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) + "\n" );
                                        }
                                        await joCall.disconnect();
                                        // reject( new Error( "CRITICAL ORACLE CALL ERROR: bad unexpected result(oracle_checkResult)" ) );
                                        return;
                                    }
                                    const joResult = JSON.parse( joOut.result );
                                    if( isVerboseTraceDetails )
                                        details.write( cc.debug( "RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) + cc.debug( " parsed " ) + cc.sunny( "result" ) + cc.debug( " field is: " ) + cc.j( joResult ) + "\n" );
                                    const gp = numberToBN( joResult.rslts[0] );
                                    if( isVerbose )
                                        details.write( cc.success( "success, computed " ) + cc.sunny( "Gas Price" ) + cc.success( "=" ) + cc.info( gp.toString() ) + cc.success( "=" ) + cc.info( "0x" + gp.toString( 16 ) ) + "\n" );
                                    resolve( gp );
                                    await joCall.disconnect();
                                    return;
                                } );
                            } catch ( err ) {
                                details.write(
                                    cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " RPC call" ) +
                                    cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) +
                                    cc.error( " exception is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
                                reject( err );
                                await joCall.disconnect();
                                return;
                            }
                        } // for( let idxAttempt = 0; idxAttempt < cntAttempts; ++idxAttempt )
                        details.write( cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_checkResult" ) + cc.normal( ")" ) + cc.error( " all attempts timed out" ) + "\n" );
                        reject( new Error( "RPC call(oracle_checkResult) all attempts timed out" ) );
                        await joCall.disconnect();
                        return;
                    } );
                } catch ( err ) {
                    details.write(
                        cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " RPC call" ) + cc.normal( "(" ) + cc.attention( "oracle_submitRequest" ) + cc.normal( ")" ) +
                        cc.error( " exception is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
                    reject( err );
                }
                await joCall.disconnect();
            } );
        } catch ( err ) {
            details.write(
                cc.fatal( "CRITICAL ORACLE CALL ERROR:" ) + cc.error( " RPC call object creation failed, error is: " ) +
                cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
            reject( err );
            return;
        }
    } );
    return promise_complete;
}
