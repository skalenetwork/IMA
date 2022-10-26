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
 * @file ptx.js
 * @copyright SKALE Labs 2019-Present
 */

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function start( details, w3, w3_opposite, chain_id, chain_id_opposite, txHash ) {
    const strLogPrefix = "";
    try {
        if( chain_id == "Mainnet" ) {
            details.write( strLogPrefix + cc.debug( "Reporting pending transaction " ) + cc.notice( txHash ) + + cc.debug( " start from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) + cc.debug( "..." ) + "\n" );
            const strNodeURL = owaspUtils.w3_2_url( w3_opposite );
            details.write( strLogPrefix + cc.debug( "Will report pending work cache to " ) + cc.u( strNodeURL ) + cc.debug( "..." ) + "\n" );
            const rpcCallOpts = null;
            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    const s = cc.fatal( "PENDING WORK START ERROR:" ) + cc.error( " JSON RPC call to S-Chain node failed" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    if( joCall )
                        await joCall.disconnect();
                    return;
                }
                const joIn = {
                    method: "skale_imaTxnInsert",
                    params: {
                        hash: "" + txHash
                    }
                };
                details.write( cc.debug( "Starting pending work with " ) + cc.j( joIn ) + "\n" );
                await joCall.call( joIn, async function( joIn, joOut, err ) {
                    if( err ) {
                        const s = cc.fatal( "PENDING WORK START ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, error: " ) + cc.warning( err ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        await joCall.disconnect();
                        return;
                    }
                    details.write( cc.debug( "Pending work start result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "result" in joOut && "success" in joOut.result ) {
                        if( joOut.result.success ) {
                            details.write( strLogPrefix + cc.success( "Success, pending work start reported" ) + "\n" );
                            await joCall.disconnect();
                            return;
                        } else {
                            details.write( strLogPrefix + cc.warning( "Pending work start was not reported with success" ) + "\n" );
                            await joCall.disconnect();
                            return;
                        }
                    } else {
                        const s = cc.fatal( "PENDING WORK START ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, returned bad answer: " ) + cc.j( joOut ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        await joCall.disconnect();
                        return;
                    }
                } );
            } );
        }
    } catch ( err ) {
        const s =
            strLogPrefix + cc.error( "PENDING WORK START ERROR: API call error from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) +
            cc.error( ": " ) + cc.error( err ) +
            "\n";
        if( verbose_get() >= RV_VERBOSE.error )
            log.write( s );
        details.write( s );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function complete( details, w3, w3_opposite, chain_id, chain_id_opposite, txHash ) {
    const strLogPrefix = "";
    try {
        if( chain_id == "Mainnet" ) {
            details.write( strLogPrefix + cc.debug( "Reporting pending transaction " ) + cc.notice( txHash ) + + cc.debug( " completion from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) + cc.debug( "..." ) + "\n" );
            const strNodeURL = owaspUtils.w3_2_url( w3_opposite );
            details.write( strLogPrefix + cc.debug( "Will report pending work cache to " ) + cc.u( strNodeURL ) + cc.debug( "..." ) + "\n" );
            const rpcCallOpts = null;
            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    const s = cc.fatal( "PENDING WORK COMPLETE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node failed" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    if( joCall )
                        await joCall.disconnect();
                    return;
                }
                const joIn = {
                    method: "skale_imaTxnErase",
                    params: {
                        hash: "" + txHash
                    }
                };
                details.write( cc.debug( "Completing pending work with " ) + cc.j( joIn ) + "\n" );
                await joCall.call( joIn, async function( joIn, joOut, err ) {
                    if( err ) {
                        const s = cc.fatal( "PENDING WORK COMPLETE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, error: " ) + cc.warning( err ) + "'n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        await joCall.disconnect();
                        return;
                    }
                    details.write( cc.debug( "Pending work complete result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "result" in joOut && "success" in joOut.result ) {
                        if( joOut.result.success ) {
                            details.write( strLogPrefix + cc.success( "Success, pending work complete reported" ) + "\n" );
                            await joCall.disconnect();
                            return;
                        } else {
                            await joCall.disconnect();
                            details.write( strLogPrefix + cc.warning( "Pending work complete was not reported with success" ) + "\n" );
                            return;
                        }
                    } else {
                        const s = cc.fatal( "PENDING WORK COMPLETE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, returned bad answer: " ) + cc.j( joOut ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        await joCall.disconnect();
                        return;
                    }
                } );
            } );

        }
    } catch ( err ) {
        const s =
            strLogPrefix + cc.error( "PENDING WORK COMPLETE ERROR: API call error from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) +
            cc.error( ": " ) + cc.error( err ) +
            "\n";
        if( verbose_get() >= RV_VERBOSE.error )
            log.write( s );
        details.write( s );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function scanner( details, w3, w3_opposite, chain_id, chain_id_opposite, cb ) {
    cb = cb || function( tx ) { };
    const strLogPrefix = "";
    try {
        details.write( strLogPrefix + cc.debug( "Scanning pending transactions from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) + cc.debug( "..." ) + "\n" );
        if( chain_id == "Mainnet" ) {
            const strNodeURL = owaspUtils.w3_2_url( w3_opposite );
            details.write( strLogPrefix + cc.debug( "Using pending work cache from " ) + cc.u( strNodeURL ) + cc.debug( "..." ) + "\n" );
            let havePendingWorkInfo = false;
            const rpcCallOpts = null;
            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node failed" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    return;
                }
                const joIn = {
                    method: "skale_imaTxnListAll",
                    params: {}
                };
                details.write( cc.debug( "Calling pending work cache with " ) + cc.j( joIn ) + "\n" );
                await joCall.call( joIn, async function( joIn, joOut, err ) {
                    if( err ) {
                        havePendingWorkInfo = true;
                        const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, error: " ) + cc.warning( err );
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return;
                    }
                    details.write( cc.debug( "Pending work cache result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "result" in joOut && "success" in joOut.result ) {
                        if( joOut.result.success && "allTrackedTXNs" in joOut.result && joOut.result.allTrackedTXNs.length > 0 ) {
                            details.write( strLogPrefix + cc.debug( "Got " ) + cc.j( joOut.result.allTrackedTXNs.length ) + cc.debug( " pending transaction(s)" ) + "\n" );
                            let cntReviewedTNXs = 0;
                            for( const joTXE of joOut.result.allTrackedTXNs ) {
                                ++ cntReviewedTNXs;
                                const joTX = {
                                    hash: "" + joTXE.hash,
                                    to: "holder.value.MessageProxy"
                                };
                                const isContinue = cb( joTX );
                                if( ! isContinue )
                                    break;
                            }
                            details.write( strLogPrefix + cc.debug( "Reviewed " ) + cc.info( cntReviewedTNXs ) + cc.debug( " pending transaction(s)" ) + "\n" );
                            havePendingWorkInfo = true;
                            return;
                        } else {
                            details.write( strLogPrefix + cc.debug( "Reviewed " ) + cc.info( 0 ) + cc.debug( " pending transaction(s)" ) + "\n" );
                            havePendingWorkInfo = true;
                            return;
                        }
                    } else {
                        const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, returned bad answer: " ) + cc.j( joOut );
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        havePendingWorkInfo = true;
                        return;
                    }
                } );
            } );
            let nWaitAttempt = 0;
            while( ! havePendingWorkInfo ) {
                await sleep( 3000 );
                ++ nWaitAttempt;
                if( nWaitAttempt >= 10 ) {
                    havePendingWorkInfo = true; // workaround for es-lint
                    const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " Wait timeout" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    break;
                }
            }
        } else { // if( chain_id == "Mainnet" )
            const mapTXs = {};
            let tx_idx = 0;
            while( true ) {
                let have_next_tx = false;
                await w3.eth.getTransactionFromBlock( "pending", tx_idx, function( err, rslt ) {
                    try {
                        if( err )
                            return;
                        if( ! rslt )
                            return;
                        if( typeof rslt != "object" )
                            return;
                        have_next_tx = true;
                        const hash = "" + rslt.hash;
                        if( hash in mapTXs )
                            return;
                        mapTXs[hash] = rslt;
                        // details.write( strLogPrefix + cc.debug( "Got pending transaction: " ) + cc.j( rslt ) + "\n" );
                        const isContinue = cb( rslt );
                        if( ! isContinue ) {
                            have_next_tx = false;
                            return;
                        }
                    } catch ( err ) {
                        if( verbose_get() >= RV_VERBOSE.error ) {
                            const s =
                                strLogPrefix + cc.error( "PENDING TRANSACTIONS ENUMERATION HANDLER ERROR: from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) +
                                cc.error( ": " ) + cc.error( err ) +
                                "\n";
                            if( verbose_get() >= RV_VERBOSE.error )
                                log.write( s );
                            details.write( s );
                        }
                    }
                } );
                if( ! have_next_tx )
                    break;
                ++ tx_idx;
            }
            details.write( strLogPrefix + cc.debug( "Got " ) + cc.j( Object.keys( mapTXs ).length ) + cc.debug( " pending transaction(s)" ) + "\n" );
        } // else from if( chain_id == "Mainnet" )
    } catch ( err ) {
        const s =
            strLogPrefix + cc.error( "PENDING TRANSACTIONS SCAN ERROR: API call error from " ) + cc.u( owaspUtils.w3_2_url( w3 ) ) +
            cc.error( ": " ) + cc.error( err ) +
            "\n";
        if( verbose_get() >= RV_VERBOSE.error )
            log.write( s );
        details.write( s );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports.start = start;
module.exports.complete = complete;
module.exports.scanner = scanner;
