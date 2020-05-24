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
 * @file log.js
 * @copyright SKALE Labs 2019-Present
 */

const cc = require( "../skale-cc/cc.js" );
const fs = require( "fs" );
let g_arrStreams = [];

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function n2s( n, sz ) {
    let s = "" + n;
    while( s.length < sz )
        s = "0" + s;
    return s;
}

function generateTimestamp() {
    const ts = new Date();
    const s =
	"" + cc.date( n2s( ts.getUTCFullYear(), 4 ) ) +
	cc.bright( "-" ) + cc.date( n2s( ts.getUTCMonth() + 1, 2 ) ) +
	cc.bright( "-" ) + cc.date( n2s( ts.getUTCDate(), 2 ) ) +
	" " + cc.time( n2s( ts.getUTCHours(), 2 ) ) +
	cc.bright( ":" ) + cc.time( n2s( ts.getUTCMinutes(), 2 ) ) +
	cc.bright( ":" ) + cc.time( n2s( ts.getUTCSeconds(), 2 ) ) +
	cc.bright( "." ) + cc.frac_time( n2s( ts.getUTCMilliseconds(), 3 ) )
	;
    return s;
}

function generateTimestampPrefix() {
    return generateTimestamp() + cc.bright( ":" ) + " ";
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function removeAllStreams() {
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

function getStreamWithFilePath( strFilePath ) {
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function createStandardOutputStream() {
    try {
        const objEntry = {
			  strPath: "stdout",
			  nMaxSizeBeforeRotation: -1,
			  nMaxFilesCount: -1,
			  objStream: null,
			  write: function( s ) {
                const x = "" + s; try {
                    if( this.objStream )
                        this.objStream.write( x );
                } catch ( err ) { }
            },
			  close: function() { this.objStream = null; },
			  open: function() { try { this.objStream = process.stdout; } catch ( err ) { } },
			  size: function() { return 0; },
			  rotate: function( nBytesToWrite ) { }
        };
        objEntry.open();
        return objEntry;
    } catch ( err ) {
    }
    return null;
}

function insertStandardOutputStream() {
    let objEntry = getStreamWithFilePath( "stdout" );
    if( objEntry !== null )
        return true;
    objEntry = createStandardOutputStream();
    if( !objEntry )
        return false;
    g_arrStreams.push( objEntry );
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function createFileOutput( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ) {
    try {
        // const fd = fs.openSync( "" + strFilePath, "a", fs.constants.O_NONBLOCK | fs.constants.O_WR );
        const objEntry = {
			  strPath: "" + strFilePath,
			  nMaxSizeBeforeRotation: 0 + nMaxSizeBeforeRotation,
			  nMaxFilesCount: 0 + nMaxFilesCount,
			  objStream: null,
			  write: function( s ) { const x = "" + s; this.rotate( x.length ); fs.appendFileSync( this.objStream, x, "utf8" ); },
			  close: function() {
                if( !this.objStream )
                    return; fs.closeSync( this.objStream ); this.objStream = null;
            },
			  open: function() { this.objStream = fs.openSync( this.strPath, "a", fs.constants.O_NONBLOCK | fs.constants.O_WR ); },
			  size: function() { try { return fs.lstatSync( this.strPath ).size; } catch ( err ) { return 0; } },
			  rotate: function( nBytesToWrite ) {
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
                        const strPath = "" + this.strPath + ( ( j == 0 ) ? "" : ( "." + j ) );
                        if( j == ( cnt - 1 ) ) {
                            try { fs.unlinkSync( strPath ); } catch ( err ) { }
                            continue;
                        }
                        const strPathPrev = "" + this.strPath + "." + ( j + 1 );
                        try { fs.unlinkSync( strPathPrev ); } catch ( err ) { }
                        try { fs.renameSync( strPath, strPathPrev ); } catch ( err ) { }
                    } // for( i = 0; i < cnt; ++ i )
                } catch ( err ) {
                }
                try {
                    this.open();
                } catch ( err ) {
                }
            }
        };
        objEntry.open();
        return objEntry;
    } catch ( err ) {
        console.log( "CRITICAL ERROR: Failed to open file system log stream for " + strFilePath + ", error is " + JSON.stringify( err ) );
    }
    return null;
}
function insertFileOutput( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ) {
    let objEntry = getStreamWithFilePath( "" + strFilePath );
    if( objEntry !== null )
        return true;
    objEntry = createFileOutput( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount );
    if( !objEntry )
        return false;
    g_arrStreams.push( objEntry );
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = {
    cc: cc,
	  write: function() {
        let s = generateTimestampPrefix(); let i = 0; let cnt = 0;
        try {
            cnt = arguments.length;
            for( i = 0; i < cnt; ++i ) {
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
            cnt = g_arrStreams.length;
            for( i = 0; i < cnt; ++i ) {
                try {
                    const objEntry = g_arrStreams[i];
                    objEntry.write( s );
                } catch ( err ) {
                }
            }
        } catch ( err ) {
        }
    },
    removeAll: function() {
        removeAllStreams();
    },
    addStdout: function() {
        return insertStandardOutputStream();
    },
    add: function( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ) {
        return insertFileOutput(
            strFilePath,
            ( nMaxSizeBeforeRotation <= 0 ) ? -1 : nMaxSizeBeforeRotation,
            ( nMaxFilesCount <= 1 ) ? -1 : nMaxFilesCount
        );
    }
}; // module.exports

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
