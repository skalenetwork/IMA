// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * SKALE IMA is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * SKALE IMA is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file pwa.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as cc from "../npms/skale-cc/cc.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as owaspUtils from "../npms/skale-owasp/owasp-utils.mjs";
import * as rpcCall from "./rpc-call.mjs";
import * as imaBLS from "./bls.mjs";
import * as imaUtils from "./utils.mjs";

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function compute_walk_node_indices( nNodeNumber, nNodesCount ) {
    if( nNodesCount <= 1 )
        return []; // PWA is N/A
    if( !( nNodeNumber >= 0 && nNodeNumber < nNodesCount ) )
        return []; // PWA is N/A
    let i = nNodeNumber - 1;
    if( i < 0 )
        i = nNodesCount - 1;
    const arr_walk_node_indices = [];
    for( ; true; ) {
        if( i == nNodeNumber )
            break;
        arr_walk_node_indices.push( i );
        -- i;
        if( i < 0 )
            i = nNodesCount - 1;
    }
    return arr_walk_node_indices;
}

export function check_loop_work_type_string_is_correct( strLoopWorkType ) {
    if( ! strLoopWorkType )
        return false;
    switch ( strLoopWorkType.toString().toLowerCase() ) {
    case "oracle":
    case "m2s":
    case "s2m":
    case "s2s":
        return true;
    }
    return false;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function compose_empty_pwaState() {
    return {
        "oracle": {
            "isInProgress": false,
            "ts": 0
        },
        "m2s": {
            "isInProgress": false,
            "ts": 0
        },
        "s2m": {
            "isInProgress": false,
            "ts": 0
        },
        "s2s": {
            "mapS2S": {
                // 0: {
                //     "isInProgress": false,
                //     "ts": 0,
                // }
            }
        }
    };
}

function get_node_progress_and_ts( joNode, strLoopWorkType, nIndexS2S ) {
    if( ! ( "pwaState" in joNode ) )
        joNode.pwaState = compose_empty_pwaState();
    strLoopWorkType = strLoopWorkType.toLowerCase();
    if( ! ( strLoopWorkType in joNode.pwaState ) ) {
        throw new Error(
            "Specified value \"" + strLoopWorkType +
            "\" is not a correct loop work type, cannot access info"
        );
    }
    if( strLoopWorkType != "s2s" )
        return joNode.pwaState[strLoopWorkType];
    if( ! ( nIndexS2S in joNode.pwaState[strLoopWorkType].mapS2S ) ) {
        joNode.pwaState[strLoopWorkType].mapS2S[nIndexS2S] = {
            "isInProgress": false,
            "ts": 0
        };
    }
    return joNode.pwaState[strLoopWorkType].mapS2S[nIndexS2S];
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export async function check_on_loop_start( imaState, strLoopWorkType, nIndexS2S ) {
    try {
        nIndexS2S = nIndexS2S || 0; // convert to number if undefined
        if( ! check_loop_work_type_string_is_correct( strLoopWorkType ) ) {
            throw new Error(
                "Specified value \"" + strLoopWorkType + "\" is not a correct loop work type"
            );
        }
        if( ! imaState.isPWA )
            return true; // PWA is N/A
        if( imaState.nNodesCount <= 1 )
            return true; // PWA is N/A
        if( !( imaState.nNodeNumber >= 0 && imaState.nNodeNumber < imaState.nNodesCount ) )
            return true; // PWA is N/A
        if( ! imaState.joSChainNetworkInfo )
            return true; // PWA is N/A
        const jarrNodes = imaState.joSChainNetworkInfo.network;
        if( ! jarrNodes )
            throw new Error( "S-Chain network info is not available yet to PWA" );
        const arr_busy_node_indices = [];
        const arr_walk_node_indices =
            compute_walk_node_indices( imaState.nNodeNumber, imaState.nNodesCount );
        if( imaState.isPrintPWA ) {
            log.write(
                cc.debug( "PWA will check loop start condition via node(s) sequence " ) +
                cc.j( arr_busy_node_indices ) + cc.debug( "..." ) +
                "\n" );
        }
        const nUtcUnixTimeStamp = Math.floor( ( new Date() ).getTime() / 1000 );
        for( let i = 0; i < arr_walk_node_indices.length; ++i ) {
            const walk_node_index = arr_walk_node_indices[i];
            const joNode = jarrNodes[walk_node_index];
            const joProps = get_node_progress_and_ts( joNode, strLoopWorkType, nIndexS2S );
            if( joProps && typeof joProps == "object" &&
                "isInProgress" in joProps && joProps.isInProgress &&
                joProps.ts != 0 && nUtcUnixTimeStamp >= joProps.ts
            ) {
                const d = nUtcUnixTimeStamp - joProps.ts;
                if( d >= imaState.nTimeoutSecondsPWA ) {
                    if( imaState.isPrintPWA ) {
                        log.write(
                            cc.warning( "PWA busy state timeout for node #" ) +
                            cc.info( walk_node_index ) +
                            cc.debug( ", old timestamp is " ) + cc.info( joProps.ts ) +
                            cc.debug( ", current system timestamp is " ) +
                            cc.info( nUtcUnixTimeStamp ) +
                            cc.debug( ", duration " ) + cc.info( d ) +
                            cc.debug( " is greater than conditionally allowed " ) +
                            cc.info( imaState.nTimeoutSecondsPWA ) +
                            cc.debug( " and exceeded by " ) +
                            cc.info( d - imaState.nTimeoutSecondsPWA ) +
                            cc.debug( " second(s)" ) +
                            "\n" );
                    }
                    joProps.isInProgress = false;
                    joProps.ts = 0;
                    continue;
                }
                arr_busy_node_indices.push( walk_node_index );
            }
        } // for( let i = 0; i < arr_walk_node_indices.length; ++i )
        if( arr_busy_node_indices.length > 0 ) {
            if( imaState.isPrintPWA ) {
                log.write(
                    cc.warning( "PWA loop start condition check failed, busy node(s): " ) +
                    cc.j( arr_busy_node_indices ) +
                    "\n" );
            }
            return false;
        }
        if( imaState.isPrintPWA )
            log.write( cc.success( "PWA loop start condition check passed" ) + "\n" );
    } catch ( err ) {
        log.write(
            cc.error( "Exception in PWA check on loop start: " ) +
            cc.error( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n" );
    }
    return true;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export async function handle_loop_state_arrived(
    imaState, nNodeNumber, strLoopWorkType, nIndexS2S, isStart, ts, signature
) {
    const se = isStart ? "start" : "end";
    let isSuccess = false;
    let joNode = null;
    try {
        if( ! check_loop_work_type_string_is_correct( strLoopWorkType ) ) {
            throw new Error(
                "Arrived value \"" + strLoopWorkType + "\" is not a correct loop work type" );
        }
        if( ! imaState.isPWA )
            return true;
        if( imaState.nNodesCount <= 1 )
            return true; // PWA is N/A
        if( !( imaState.nNodeNumber >= 0 && imaState.nNodeNumber < imaState.nNodesCount ) )
            return true; // PWA is N/A
        if( ! imaState.joSChainNetworkInfo )
            return true; // PWA is N/A
        const jarrNodes = imaState.joSChainNetworkInfo.network;
        if( ! jarrNodes )
            throw new Error( "S-Chain network info is not available yet to PWA" );
        joNode = jarrNodes[nNodeNumber];
        const joProps = get_node_progress_and_ts( joNode, strLoopWorkType, nIndexS2S );
        if( imaState.isPrintPWA ) {
            log.write(
                cc.debug( "PWA loop-" ) + cc.attention( se ) +
                cc.debug( " state arrived for node " ) + cc.info( nNodeNumber ) +
                cc.debug( ", PWA state " ) + cc.j( joNode.pwaState ) +
                cc.debug( ", arrived signature is " ) + cc.j( signature ) +
                "\n" );
        }
        const strMessageHash =
            imaBLS.keccak256_4_pending_work_analysis(
                nNodeNumber, strLoopWorkType, isStart, 0 + ts );
        const isSignatureOK =
            await imaBLS.do_verify_ready_hash(
                strMessageHash, nNodeNumber, signature, imaState.isPrintPWA );
        if( ! isSignatureOK )
            throw new Error( "BLS verification failed" );
        joProps.isInProgress = isStart ? true : false;
        joProps.ts = 0 + ts;
        if( imaState.isPrintPWA ) {
            log.write(
                cc.success( "PWA loop-" ) + cc.attention( se ) +
                cc.success( " state successfully verified for node " ) + cc.info( nNodeNumber ) +
                cc.success( ", now have PWA state " ) + cc.j( joNode.pwaState ) +
                cc.success( ", arrived signature is " ) + cc.j( signature ) +
                "\n" );
        }
        isSuccess = true;
    } catch ( err ) {
        isSuccess = false;
        log.write(
            cc.error( "Exception in PWA handler for loop-" ) + cc.attention( se ) +
            cc.error( " for node " ) + cc.info( nNodeNumber ) + cc.error( ", PWA state " ) +
            cc.j( ( joNode && "pwaState" in joNode ) ? joNode.pwaState : "N/A" ) +
            cc.error( ", arrived signature is " ) + cc.j( signature ) +
            cc.error( ", error is: " ) + cc.error( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n" );
    }
    return isSuccess;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

async function notify_on_loop_impl( imaState, strLoopWorkType, nIndexS2S, isStart ) {
    const se = isStart ? "start" : "end";
    try {
        nIndexS2S = nIndexS2S || 0; // convert to number if undefined
        if( ! check_loop_work_type_string_is_correct( strLoopWorkType ) ) {
            throw new Error(
                "Specified value \"" + strLoopWorkType + "\" is not a correct loop work type" );
        }
        if( ! imaState.isPWA )
            return true;
        if( imaState.nNodesCount <= 1 )
            return true; // PWA is N/A
        if( !( imaState.nNodeNumber >= 0 && imaState.nNodeNumber < imaState.nNodesCount ) )
            return true; // PWA is N/A
        if( ! imaState.joSChainNetworkInfo )
            return true; // PWA is N/A
        const jarrNodes = imaState.joSChainNetworkInfo.network;
        if( ! jarrNodes )
            throw new Error( "S-Chain network info is not available yet to PWA" );
        const nUtcUnixTimeStamp = Math.floor( ( new Date() ).getTime() / 1000 );

        const strMessageHash =
            imaBLS.keccak256_4_pending_work_analysis(
                0 + imaState.nNodeNumber, strLoopWorkType, isStart, nUtcUnixTimeStamp );
        const signature = await imaBLS.do_sign_ready_hash( strMessageHash, imaState.isPrintPWA );
        await handle_loop_state_arrived(
            imaState, imaState.nNodeNumber, strLoopWorkType,
            nIndexS2S, isStart, nUtcUnixTimeStamp, signature
        ); // save own started

        for( let i = 0; i < jarrNodes.length; ++i ) {
            if( i == imaState.nNodeNumber )
                continue; // skip this node
            const joNode = jarrNodes[i];
            const strNodeURL = imaUtils.compose_ima_agent_node_url( joNode );
            const rpcCallOpts = null;
            /*await*/ rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    log.write(
                        cc.error( "PWA failed to create loop-" ) + cc.attention( se ) +
                        cc.error( " notification RPC call to node #" ) + cc.info( i ) +
                        cc.error( " with URL " ) + cc.u( strNodeURL ) +
                        cc.error( ", error is: " ) +
                        cc.error( owaspUtils.extract_error_message( err ) ) +
                        "\n"
                    );
                    return;
                }
                /*await*/ joCall.call( {
                    "method": "skale_imaNotifyLoopWork",
                    "params": {
                        "nNodeNumber": 0 + imaState.nNodeNumber,
                        "strLoopWorkType": "" + strLoopWorkType,
                        "nIndexS2S": 0 + nIndexS2S,
                        "isStart": isStart ? true : false,
                        "ts": nUtcUnixTimeStamp,
                        "signature": signature
                    }
                }, async function( joIn, joOut, err ) {
                    if( err ) {
                        log.write(
                            cc.error( "PWA failed to perform loop-" ) + cc.attention( se ) +
                            cc.error( " notification RPC call to node #" ) + cc.info( i ) +
                            cc.error( " with URL " ) + cc.u( strNodeURL ) +
                            cc.error( ", error is: " ) +
                            cc.error( owaspUtils.extract_error_message( err ) ) +
                            "\n"
                        );
                        await joCall.disconnect();
                        return;
                    }
                    if( imaState.isPrintPWA ) {
                        log.write(
                            cc.success( "Was successfully sent PWA loop-" ) + cc.attention( se ) +
                            cc.success( " notification to node #" ) + cc.info( i ) +
                            cc.success( " with URL " ) + cc.u( strNodeURL ) +
                            "\n"
                        );
                    }
                    await joCall.disconnect();
                } ); // joCall.call ...
            } ); // rpcCall.create ...
        } // for( let i = 0; i < jarrNodes.length; ++i )
    } catch ( err ) {
        log.write(
            cc.error( "Exception in PWA notify on loop " ) + cc.attention( se ) +
            cc.error( ": " ) + cc.error( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n" );
    }
    return true;
}

export async function notify_on_loop_start( imaState, strLoopWorkType, nIndexS2S ) {
    return await notify_on_loop_impl( imaState, strLoopWorkType, nIndexS2S, true );
}

export async function notify_on_loop_end( imaState, strLoopWorkType, nIndexS2S ) {
    return await notify_on_loop_impl( imaState, strLoopWorkType, nIndexS2S, false );
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
