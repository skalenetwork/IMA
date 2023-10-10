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
 * @file imaTransferErrorHandling.mjs
 * @copyright SKALE Labs 2019-Present
 */

import { UniversalDispatcherEvent, EventDispatcher }
    from "../skale-cool-socket/eventDispatcher.mjs";

export function verifyTransferErrorCategoryName( strCategory ) {
    return "" + ( strCategory ? strCategory : "default" );
}

const gMaxLastTransferErrors = 20;
const gArrLastTransferErrors = [];
let gMapTransferErrorCategories = { };

export const saveTransferEvents = new EventDispatcher();

export function saveTransferError( strCategory, textLog, ts ) {
    ts = ts || Math.round( ( new Date() ).getTime() / 1000 );
    const c = verifyTransferErrorCategoryName( strCategory );
    const joTransferEventError = {
        "ts": ts,
        "category": "" + c,
        "textLog": "" + textLog.toString()
    };
    gArrLastTransferErrors.push( joTransferEventError );
    while( gArrLastTransferErrors.length > gMaxLastTransferErrors )
        gArrLastTransferErrors.shift();
    gMapTransferErrorCategories["" + c] = true;
    saveTransferEvents.dispatchEvent(
        new UniversalDispatcherEvent(
            "error",
            { "detail": joTransferEventError } ) );
}

export function saveTransferSuccess( strCategory ) {
    const c = verifyTransferErrorCategoryName( strCategory );
    try { delete gMapTransferErrorCategories["" + c]; } catch ( err ) { }
    saveTransferEvents.dispatchEvent(
        new UniversalDispatcherEvent(
            "success",
            { "detail": { "category": strCategory } } ) );
}

export function saveTransferSuccessAll() {
    // clear all transfer error categories, out of time frame
    gMapTransferErrorCategories = { };
}

export function getLastTransferErrors( isIncludeTextLog ) {
    if( typeof isIncludeTextLog == "undefined" )
        isIncludeTextLog = true;
    const jarr = JSON.parse( JSON.stringify( gArrLastTransferErrors ) );
    if( ! isIncludeTextLog ) {
        for( let i = 0; i < jarr.length; ++ i ) {
            const jo = jarr[i];
            if( "textLog" in jo )
                delete jo.textLog;
        }
    }
    return jarr;
}

export function getLastErrorCategories() {
    return Object.keys( gMapTransferErrorCategories );
}

let gFlagIsEnabledProgressiveEventsScan = true;

export function getEnabledProgressiveEventsScan() {
    return ( !!gFlagIsEnabledProgressiveEventsScan );
}
export function setEnabledProgressiveEventsScan( isEnabled ) {
    gFlagIsEnabledProgressiveEventsScan = ( !!isEnabled );
}
