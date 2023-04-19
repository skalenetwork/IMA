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
 * @file log.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as cc from "../skale-cc/cc.mjs";
import * as fs from "fs";

let g_arrStreams = [];

let g_bLogWithTimeStamps = true;

let g_id = 0;

export function getPrintTimestamps() {
    return g_bLogWithTimeStamps;
}

export function setPrintTimestamps( b ) {
    g_bLogWithTimeStamps = b ? true : false;
}

export function n2s( n, sz ) {
    let s = "" + n;
    while( s.length < sz )
        s = "0" + s;
    return s;
}

export function generateTimestampString( ts, isColorized ) {
    isColorized =
        ( typeof isColorized == "undefined" )
            ? true : ( isColorized ? true : false );
    ts = ( ts instanceof Date ) ? ts : new Date();
    const cc_date = function( x ) { return isColorized ? cc.date( x ) : x; };
    const cc_time = function( x ) { return isColorized ? cc.time( x ) : x; };
    const cc_frac_time = function( x ) { return isColorized ? cc.frac_time( x ) : x; };
    const cc_bright = function( x ) { return isColorized ? cc.bright( x ) : x; };
    const s =
        "" + cc_date( n2s( ts.getUTCFullYear(), 4 ) ) +
        cc_bright( "-" ) + cc_date( n2s( ts.getUTCMonth() + 1, 2 ) ) +
        cc_bright( "-" ) + cc_date( n2s( ts.getUTCDate(), 2 ) ) +
        " " + cc_time( n2s( ts.getUTCHours(), 2 ) ) +
        cc_bright( ":" ) + cc_time( n2s( ts.getUTCMinutes(), 2 ) ) +
        cc_bright( ":" ) + cc_time( n2s( ts.getUTCSeconds(), 2 ) ) +
        cc_bright( "." ) + cc_frac_time( n2s( ts.getUTCMilliseconds(), 3 ) )
        ;
    return s;
}

export function generateTimestampPrefix( ts, isColorized ) {
    return generateTimestampString( ts, isColorized ) + cc.bright( ":" ) + " ";
}

export function removeAllStreams() {
    let i = 0; let cnt = 0;
    try {
        cnt = g_arrStreams.length;
        for( i = 0; i < cnt; ++i ) {
            try {
                const objEntry = g_arrStreams[i];
                objEntry.objStream.close();
            } catch ( err ) {
            }
        }
    } catch ( err ) {
    }
    g_arrStreams = [];
}

export function getStreamWithFilePath( strFilePath ) {
    try {
        let i = 0; const cnt = g_arrStreams.length;
        for( i = 0; i < cnt; ++i ) {
            try {
                const objEntry = g_arrStreams[i];
                if( objEntry.strPath === strFilePath )
                    return objEntry;
            } catch ( err ) {
            }
        }
    } catch ( err ) {
    }
    return null;
}

export function createStandardOutputStream() {
    try {
        const objEntry = {
            "id": g_id ++,
            "strPath": "stdout",
            "nMaxSizeBeforeRotation": -1,
            "nMaxFilesCount": -1,
            "objStream": null,
            "haveOwnTimestamps": false,
            "strOwnIndent": "",
            "write": function( s ) {
                const x =
                    this.strOwnIndent +
                    + ( this.haveOwnTimestamps ? generateTimestampPrefix( null, true ) : "" ) +
                    s;
                try {
                    if( this.objStream )
                        this.objStream.write( x );
                } catch ( err ) { }
            },
            "close": function() { this.objStream = null; },
            "open": function() { try { this.objStream = process.stdout; } catch ( err ) { } },
            "size": function() { return 0; },
            "rotate": function( nBytesToWrite ) { },
            "toString": function() { return "" + strFilePath; },
            "exposeDetailsTo": function( otherStream, strTitle, isSuccess ) { }
        };
        objEntry.open();
        return objEntry;
    } catch ( err ) {
    }
    return null;
}

export function insertStandardOutputStream() {
    let objEntry = getStreamWithFilePath( "stdout" );
    if( objEntry !== null )
        return true;
    objEntry = createStandardOutputStream();
    if( !objEntry )
        return false;
    g_arrStreams.push( objEntry );
    return true;
}

export function createMemoryOutputStream() {
    try {
        const objEntry = {
            "id": g_id ++,
            "strPath": "memory",
            "nMaxSizeBeforeRotation": -1,
            "nMaxFilesCount": -1,
            "strAccumulatedLogText": "",
            "haveOwnTimestamps": true,
            "strOwnIndent": "    ",
            "write": function( s ) {
                if( this.strAccumulatedLogText.length == 0 ||
                    this.strAccumulatedLogText[this.strAccumulatedLogText.length - 1] == "\n"
                ) {
                    this.strAccumulatedLogText += this.strOwnIndent;
                    if( this.haveOwnTimestamps )
                        this.strAccumulatedLogText += generateTimestampPrefix( null, true );
                }
                this.strAccumulatedLogText += s;
            },
            "clear": function() { this.strAccumulatedLogText = ""; },
            "close": function() { this.clear(); },
            "open": function() { this.clear(); },
            "size": function() { return 0; },
            "rotate": function( nBytesToWrite ) { this.strAccumulatedLogText = ""; },
            "toString": function() { return "" + this.strAccumulatedLogText; },
            "exposeDetailsTo":
                function( otherStream, strTitle, isSuccess ) {
                    strTitle = strTitle
                        ? ( cc.bright( " (" ) + cc.attention( strTitle ) + cc.bright( ")" ) ) : "";
                    const strSuccessPrefix = isSuccess
                        ? cc.success( "SUCCESS" ) : cc.fatal( "ERROR" );
                    otherStream.write(
                        cc.bright( "\n--- --- --- --- --- GATHERED " ) + strSuccessPrefix +
                        cc.bright( " DETAILS FOR LATEST(" ) + cc.sunny( strTitle ) +
                        cc.bright( " action (" ) + cc.sunny( "BEGIN" ) +
                        cc.bright( ") --- --- ------ --- \n" ) +
                        this.strAccumulatedLogText +
                        cc.bright( "--- --- --- --- --- GATHERED " ) + strSuccessPrefix +
                        cc.bright( " DETAILS FOR LATEST(" ) + cc.sunny( strTitle ) +
                        cc.bright( " action (" ) + cc.sunny( "END" ) +
                        cc.bright( ") --- --- --- --- ---\n"
                        )
                    );
                }
        };
        objEntry.open();
        return objEntry;
    } catch ( err ) {
    }
    return null;
}

export function insertMemoryOutputStream() {
    let objEntry = getStreamWithFilePath( "memory" );
    if( objEntry !== null )
        return true;
    objEntry = createMemoryOutputStream();
    if( !objEntry )
        return false;
    g_arrStreams.push( objEntry );
    return true;
}

export function createFileOutput( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ) {
    try {
        const objEntry = {
            "id": g_id ++,
            "strPath": "" + strFilePath,
            "nMaxSizeBeforeRotation": 0 + nMaxSizeBeforeRotation,
            "nMaxFilesCount": 0 + nMaxFilesCount,
            "objStream": null,
            "haveOwnTimestamps": false,
            "strOwnIndent": "",
            "write": function( s ) {
                const x =
                    this.strOwnIndent +
                    ( this.haveOwnTimestamps ? generateTimestampPrefix( null, true ) : "" ) +
                    s;
                try {
                    this.rotate( x.length );
                    fs.appendFileSync( this.objStream, x, "utf8" );
                } catch ( err ) { }
            },
            "close": function() {
                if( !this.objStream )
                    return;
                fs.closeSync( this.objStream );
                this.objStream = null;
            },
            "open": function() {
                this.objStream =
                    fs.openSync( this.strPath, "a", fs.constants.O_NONBLOCK | fs.constants.O_WR );
            },
            "size": function() {
                try { return fs.lstatSync( this.strPath ).size; } catch ( err ) { return 0; }
            },
            "rotate": function( nBytesToWrite ) {
                try {
                    if( this.nMaxSizeBeforeRotation <= 0 || this.nMaxFilesCount <= 1 )
                        return;
                    this.close();
                    const nFileSize = this.size();
                    const nNextSize = nFileSize + nBytesToWrite;
                    if( nNextSize <= this.nMaxSizeBeforeRotation ) {
                        this.open();
                        return;
                    }
                    let i = 0; const cnt = 0 + this.nMaxFilesCount;
                    for( i = 0; i < cnt; ++i ) {
                        const j = this.nMaxFilesCount - i - 1;
                        const strPath = "" + this.strPath + ( ( j === 0 ) ? "" : ( "." + j ) );
                        if( j == ( cnt - 1 ) ) {
                            try { fs.unlinkSync( strPath ); } catch ( err ) { }
                            continue;
                        }
                        const strPathPrev = "" + this.strPath + "." + ( j + 1 );
                        try { fs.unlinkSync( strPathPrev ); } catch ( err ) { }
                        try { fs.renameSync( strPath, strPathPrev ); } catch ( err ) { }
                    }
                } catch ( err ) {
                }
                try {
                    this.open();
                } catch ( err ) {
                }
            },
            "toString": function() { return "" + strFilePath; },
            "exposeDetailsTo": function( otherStream, strTitle, isSuccess ) { }
        };
        objEntry.open();
        return objEntry;
    } catch ( err ) {
        console.log(
            "CRITICAL ERROR: Failed to open file system log stream for " + strFilePath +
            ", error is " + JSON.stringify( err )
        );
    }
    return null;
}
export function insertFileOutput( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ) {
    let objEntry = getStreamWithFilePath( "" + strFilePath );
    if( objEntry !== null )
        return true;
    objEntry = createFileOutput( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount );
    if( !objEntry )
        return false;
    g_arrStreams.push( objEntry );
    return true;
}

export function write() {
    let s = getPrintTimestamps() ? generateTimestampPrefix( null, true ) : "", i = 0;
    try {
        for( i = 0; i < arguments.length; ++i ) {
            try {
                s += arguments[i];
            } catch ( err ) {
            }
        }
    } catch ( err ) {
    }
    try {
        if( s.length <= 0 )
            return;
        const cnt = g_arrStreams.length;
        for( i = 0; i < cnt; ++i ) {
            try {
                const objEntry = g_arrStreams[i];
                objEntry.write( s );
            } catch ( err ) {
            }
        }
    } catch ( err ) {
    }
}

export function removeAll() {
    removeAllStreams();
}

export function addStdout() {
    return insertStandardOutputStream();
}

export function addMemory() {
    return insertMemoryOutputStream();
}

export function createMemoryStream() {
    return createMemoryOutputStream();
}

export function add( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ) {
    return insertFileOutput(
        strFilePath,
        ( nMaxSizeBeforeRotation <= 0 ) ? -1 : nMaxSizeBeforeRotation,
        ( nMaxFilesCount <= 1 ) ? -1 : nMaxFilesCount
    );
}

export function close() {
    // for compatibility with created streams
}

export function exposeDetailsTo() {
    // for compatibility with created streams
}

export function toString() {
    // for compatibility with created streams
    return "";
}
