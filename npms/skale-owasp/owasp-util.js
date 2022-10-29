
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
 * @file owasp-util.js
 * @copyright SKALE Labs 2019-Present
 */

// introduction: https://github.com/Checkmarx/JS-SCP
// main PDF with rules to follow: https://www.gitbook.com/download/pdf/book/checkmarx/JS-SCP
// top 10 hit parade: https://owasp.org/www-project-top-ten/

const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );

const cc = require( "../skale-cc/cc.js" );
const w3mod = require( "web3" );
const ethereumjs_tx = require( "ethereumjs-tx" );
const ethereumjs_wallet = require( "ethereumjs-wallet" );
const ethereumjs_util = require( "ethereumjs-util" );

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function rxIsInt( val ) {
    try {
        const intRegex = /^-?\d+$/;
        if( !intRegex.test( val ) )
            return false;
        const intVal = parseInt( val, 10 );
        if( parseFloat( val ) == intVal && ( !isNaN( intVal ) ) )
            return true;
    } catch ( err ) {
    }
    return false;
}

function rxIsFloat( val ) {
    try {
        const floatRegex = /^-?\d+(?:[.,]\d*?)?$/;
        if( !floatRegex.test( val ) )
            return false;
        val = parseFloat( val );
        if( isNaN( val ) )
            return false;
        return true;
    } catch ( err ) {
    }
    return false;
}

function validateRadix( value, radix ) {
    value = "" + ( value ? value.toString() : "10" );
    value = value.trim();
    radix = ( radix == null || radix == undefined )
        ? ( ( value.length > 2 && value[0] == "0" && ( value[1] == "x" || value[1] == "X" ) ) ? 16 : 10 )
        : parseInt( radix, 10 );
    return radix;
}

function validateInteger( value, radix ) {
    try {
        value = "" + value;
        value = value.trim();
        if( value.length < 1 )
            return false;
        radix = validateRadix( value, radix );
        if( ( !isNaN( value ) ) &&
            ( parseInt( Number( value ), radix ) == value || radix !== 10 ) &&
            ( !isNaN( parseInt( value, radix ) ) )
        )
            return true;
    } catch ( err ) {
    }
    return false;
}

function toInteger( value, radix ) {
    try {
        radix = validateRadix( value, radix );
        if( !validateInteger( value, radix ) )
            return NaN;
        return parseInt( value, radix );
    } catch ( err ) {
    }
    return false;
}

function validateFloat( value ) {
    try {
        const f = parseFloat( value );
        if( isNaN( f ) )
            return false;
        return true;
    } catch ( err ) {
    }
    return false;
}

function toFloat( value ) {
    try {
        const f = parseFloat( value );
        return f;
    } catch ( err ) {
    }
    return false;
}

function validateURL( s ) {
    const u = toURL( s );
    if( u == null )
        return false;
    return true;
}

function toURL( s ) {
    try {
        if( s == null || s == undefined )
            return null;
        if( typeof s !== "string" )
            return null;
        s = s.trim();
        if( s.length <= 0 )
            return null;
        const sc = s[0];
        if( sc == "\"" || sc == "'" ) {
            const cnt = s.length;
            if( s[cnt - 1] == sc ) {
                const ss = s.substring( 1, cnt - 1 );
                const u = toURL( ss );
                if( u != null && u != undefined )
                    u.strStrippedStringComma = sc;
                return u;
            }
            return null;
        }
        const u = new URL( s );
        if( !u.hostname )
            return null;
        if( u.hostname.length === 0 )
            return null;
        u.strStrippedStringComma = null;
        return u;
    } catch ( err ) {
        return null;
    }
}

function toStringURL( s, defValue ) {
    defValue = defValue || "";
    try {
        const u = toURL( s );
        if( u == null || u == undefined )
            return defValue;
        return u.toString();
    } catch ( err ) {
        return defValue;
    }
}

function toBoolean( value ) {
    let b = false;
    try {
        if( typeof value === "boolean" )
            return value;
        if( typeof value === "string" ) {
            const ch = value[0].toLowerCase();
            if( ch == "y" || ch == "t" )
                b = true; else if( validateInteger( value ) )
                b = !!toInteger( value ); else if( validateFloat( value ) )
                b = !!toFloat( value ); else
                b = !!b;
        } else
            b = !!b;
    } catch ( err ) {
        b = false;
    }
    b = !!b;
    return b;
}

// see https://ethereum.stackexchange.com/questions/1374/how-can-i-check-if-an-ethereum-address-is-valid
function validateEthAddress( value ) {
    try {
        if( ethereumjs_util.isValidAddress( ensure_starts_with_0x( value ) ) )
            return true;
    } catch ( err ) {
    }
    return false;
}

// see https://gist.github.com/miguelmota/20fcd7c5c2604907dcbba749ea3f1e8c
function validateEthPrivateKey( value ) {
    try {
        value = "" + ( value ? value.toString() : "" );
        const buffer = Buffer.from( remove_starting_0x( value ), "hex" );
        if( ethereumjs_util.isValidPrivate( buffer ) )
            return true;
    } catch ( err ) {
    }
    return false;
}

function toEthAddress( value, defValue ) {
    try {
        value = "" + ( value ? ensure_starts_with_0x( value.toString() ) : "" );
        defValue = defValue || "";
        if( !validateEthAddress( value ) )
            return defValue;
    } catch ( err ) {
    }
    return value;
}

function toEthPrivateKey( value, defValue ) {
    try {
        value = "" + ( value ? value.toString() : "" );
        defValue = defValue || "";
        if( !validateEthPrivateKey( value ) )
            return defValue;
    } catch ( err ) {
    }
    return value;
}

function verifyArgumentWithNonEmptyValue( joArg ) {
    if( ( !joArg.value ) || ( typeof joArg.value === "string" && joArg.value.length === 0 ) ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must not be empty" ) );
        process.exit( 126 );
    }
    return joArg;
}

function verifyArgumentIsURL( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const u = toURL( joArg.value );
        if( u == null ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
            process.exit( 126 );
        }
        if( u.hostname.length <= 0 ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
            process.exit( 126 );
        }
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
        process.exit( 126 );
    }
}

function verifyArgumentIsInteger( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        if( !validateInteger( joArg.value ) ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
            process.exit( 126 );
        }
        joArg.value = toInteger( joArg.value );
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
        process.exit( 126 );
    }
}

function verifyArgumentIsIntegerIpPortNumber( joArg, isEnableZero ) {
    try {
        verifyArgumentIsInteger( joArg );
        if( joArg.value < 0 )
            throw new Error( "Port number " + joArg.value + " cannot be negative" );
        if( ( !isEnableZero ) && joArg.value < 1 )
            throw new Error( "Port number " + joArg.value + " too small" );
        if( joArg.value > 65535 )
            throw new Error( "Port number " + joArg.value + " too big" );
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer IP port number" ) );
        process.exit( 126 );
    }
}

function verifyArgumentIsPathToExistingFile( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const stats = fs.lstatSync( joArg.value );
        if( stats.isDirectory() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing file, path to folder provided" ) );
            process.exit( 126 );
        }
        if( !stats.isFile() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing file, bad path provided" ) );
            process.exit( 126 );
        }
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing file" ) );
        process.exit( 126 );
    }
}

function verifyArgumentIsPathToExistingFolder( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const stats = fs.lstatSync( joArg.value );
        if( stats.isFile() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing folder, path to file provided" ) );
            process.exit( 126 );
        }
        if( !stats.isDirectory() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing folder, bad path provided" ) );
            process.exit( 126 );
        }
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing folder" ) );
        process.exit( 126 );
    }
}

function verifyArgumentIsArrayOfIntegers( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        if( joArg.value.length < 3 ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " length " ) + cc.warning( joArg.value.length ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be bigger than 2" ) );
            process.exit( 126 );
        }
        if( joArg.value[0] !== "[" || joArg.value[joArg.value.length - 1] !== "]" ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " first and last symbol " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be brackets" ) );
            process.exit( 126 );
        }
        const newValue = joArg.value.replace( "[", "" ).replace( "]", "" ).split( "," );
        for( let index = 0; index < newValue.length; index++ ) {
            if( !newValue[index] || ( typeof newValue[index] === "string" && newValue[index].length === 0 ) ) {
                console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( newValue[index] ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must not be empty" ) );
                process.exit( 126 );
            }
            if( !validateInteger( newValue[index] ) ) {
                console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( newValue[index] ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
                process.exit( 126 );
            }
            newValue[index] = toInteger( newValue[index] );
        }
        return newValue;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer array" ) );
        process.exit( 126 );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ensure_starts_with_0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return "0x" + s;
    if( s[0] == "0" && s[1] == "x" )
        return s;
    return "0x" + s;
}

function remove_starting_0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return s;
    if( s[0] == "0" && s[1] == "x" )
        return s.substr( 2 );
    return s;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function inet_ntoa( n ) {
    const a = ( ( n >> 24 ) & 0xFF ) >>> 0;
    const b = ( ( n >> 16 ) & 0xFF ) >>> 0;
    const c = ( ( n >> 8 ) & 0xFF ) >>> 0;
    const d = ( n & 0xFF ) >>> 0;
    return ( a + "." + b + "." + c + "." + d );
}

function ip_from_hex( hex ) {
    return inet_ntoa( parseInt( remove_starting_0x( hex ), 16 ) );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function private_key_2_public_key( w3, keyPrivate ) {
    if( w3 == null || w3 == undefined || keyPrivate == null || keyPrivate == undefined )
        return "";
    // get a wallet instance from a private key
    const privateKeyBuffer = ethereumjs_util.toBuffer( ensure_starts_with_0x( keyPrivate ) );
    const wallet = ethereumjs_wallet.fromPrivateKey( privateKeyBuffer );
    // get a public key
    const keyPublic = wallet.getPublicKeyString();
    return remove_starting_0x( keyPublic );
}

function public_key_2_account_address( w3, keyPublic ) {
    if( w3 == null || w3 == undefined || keyPublic == null || keyPublic == undefined )
        return "";
    const hash = w3.utils.sha3( ensure_starts_with_0x( keyPublic ) );
    const strAddress = ensure_starts_with_0x( hash.substr( hash.length - 40 ) );
    return strAddress;
}

function private_key_2_account_address( w3, keyPrivate ) {
    const keyPublic = private_key_2_public_key( w3, keyPrivate );
    const strAddress = public_key_2_account_address( w3, keyPublic );
    return strAddress;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// example: "1ether" -> "1000000000000000000"
// supported suffixes, lowercase
// const g_arrMoneyNameSuffixes = [ "ether", "finney", "szabo", "shannon", "lovelace", "babbage", "wei" ];

// supported suffix aliases, lowercase
const g_mapMoneyNameSuffixAliases = {
    "ethe": "ether",
    "ethr": "ether",
    "eth": "ether",
    "eter": "ether",
    "ete": "ether",
    "et": "ether",
    "eh": "ether",
    "er": "ether",
    // "e": "ether",
    "finne": "finney",
    "finn": "finney",
    "fin": "finney",
    "fn": "finney",
    "fi": "finney",
    // "f": "finney",
    "szab": "szabo",
    "szb": "szabo",
    "sza": "szabo",
    "sz": "szabo",
    "shanno": "shannon",
    "shannn": "shannon",
    "shann": "shannon",
    "shan": "shannon",
    "sha": "shannon",
    "shn": "shannon",
    "sh": "shannon",
    "lovelac": "lovelace",
    "lovela": "lovelace",
    "lovel": "lovelace",
    "love": "lovelace",
    "lovl": "lovelace",
    "lvl": "lovelace",
    "lvla": "lovelace",
    "lvlc": "lovelace",
    "lvc": "lovelace",
    "lv": "lovelace",
    "lo": "lovelace",
    "lc": "lovelace",
    "ll": "lovelace",
    // "l": "lovelace",
    "babbag": "babbage",
    "babba": "babbage",
    "babbg": "babbage",
    "babb": "babbage",
    "bab": "babbage",
    "bag": "babbage",
    "bbb": "babbage",
    "bb": "babbage",
    "bg": "babbage",
    "ba": "babbage",
    "be": "babbage",
    // "b": "babbage",
    "we": "wei",
    "wi": "wei",
    // "w": "wei",
    //
    // next going as is because supported by wev3.utils.toWei() API
    //
    "noether": "noether",
    "noeth": "noether",
    "kwei": "kwei",
    "femtoether": "femtoether",
    "femto": "femtoether",
    "mwei": "mwei",
    "picoether": "picoether",
    "pico": "picoether",
    "gwei": "gwei",
    "nanoether": "nanoether",
    "nano": "nanoether",
    "microether": "microether",
    "micro": "microether",
    "milliether": "milliether",
    "milli": "milliether",
    "kether": "kether",
    "mether": "mether",
    "gether": "gether",
    "tether": "tether"
};

function parseMoneyUnitName( s ) {
    s = s.trim().toLowerCase();
    if( s == "" )
        return "wei";
    if( s in g_mapMoneyNameSuffixAliases ) {
        s = g_mapMoneyNameSuffixAliases[s];
        return s;
    }
    // if( g_arrMoneyNameSuffixes.indexOf( s ) >= 0 )
    //     return s;
    // throw new Error( "\"" + s + "\" is unknown money unit name" );
    return s;
}

function is_numeric( s ) {
    return /^\d+$/.test( s );
}

function parseMoneySpecToWei( w3, s, isThrowException ) {
    try {
        w3 = w3 || global.w3mod;
        isThrowException = isThrowException ? true : false;
        if( s == null || s == undefined ) {
            if( isThrowException )
                throw new Error( "no parse-able value provided" );
            return "0";
        }
        s = s.toString().trim();
        let strNumber = "";
        while( s.length > 0 ) {
            const chr = s[0];
            if( is_numeric( chr ) || chr == "." ) {
                strNumber += chr;
                s = s.substr( 1 ); // remove first character
                continue;
            }
            if( chr == " " || chr == "\t" || chr == "\r" || chr == "\n" )
                s = s.substr( 1 ); // remove first character
            s = s.trim().toLowerCase();
            break;
        }
        // here s is rest suffix string, number is number as string or empty string
        if( strNumber == "" )
            throw new Error( "no number or float value found" );
        s = parseMoneyUnitName( s );
        s = w3.utils.toWei( strNumber, s );
        s = s.toString( 10 );
        return s;
    } catch ( err ) {
        if( isThrowException )
            throw new Error( "Parse error in parseMoneySpecToWei(\"" + s + "\"), error is: " + err.toString() );
    }
    return "0";
}

function fn_address_impl_( w3 ) {
    if( this.address_ == undefined || this.address_ == null )
        this.address_ = "" + owaspUtils.private_key_2_account_address( w3, this.privateKey );
    return this.address_;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function compute_chain_id_from_schain_name( w3, strName ) {
    let h = w3.utils.soliditySha3( strName );
    h = remove_starting_0x( h ).toLowerCase();
    while( h.length < 64 )
        h = "0" + h;
    h = h.substr( 0, 14 );
    return "0x" + h;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function w3provider_2_url( provider ) {
    if( ! provider )
        return null;
    if( "host" in provider ) {
        const u = provider.host.toString();
        if( u && cc.safeURL( u ) )
            return u;
    }
    if( "url" in provider ) {
        const u = provider.url.toString();
        if( u && cc.safeURL( u ) )
            return u;
    }
    return null;
}

function w3_2_url( w3 ) {
    if( ! w3 )
        return null;
    if( !( "currentProvider" in w3 ) )
        return null;
    return w3provider_2_url( w3.currentProvider );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function extract_error_message( jo, strDefaultErrorText ) {
    strDefaultErrorText = strDefaultErrorText || "unknown error or error without a description";
    try {
        if( ! jo )
            return strDefaultErrorText;
        if( typeof jo != "object" )
            return strDefaultErrorText;
        let strStack = "";
        if( "stack" in jo && jo.stack && typeof jo.stack == "object" && "length" in jo.stack && jo.stack.length > 0 ) {
            strStack += "\nCall stack from error object:";
            for( let i = 0; i < jo.stack.length; ++ i )
                strStack += "\n" + jo.stack[i].toString();
        }
        if( "error" in jo ) {
            jo = jo.error;
            if( typeof jo == "string" )
                return jo;
            if( typeof jo != "object" )
                return strDefaultErrorText + "(" + jo.toString() + ")" + strStack;
        }
        if( "message" in jo ) {
            jo = jo.message;
            if( typeof jo == "string" )
                return jo + strStack;
        }
        strDefaultErrorText += "(" + jo.toString() + ")" + strStack;
    } catch ( err ) {
    }
    return strDefaultErrorText;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    cc: cc,
    w3mod: w3mod,
    ethereumjs_tx: ethereumjs_tx,
    ethereumjs_wallet: ethereumjs_wallet,
    ethereumjs_util: ethereumjs_util,
    owaspAddUsageRef: function() { },
    rxIsInt: rxIsInt,
    rxIsFloat: rxIsFloat,
    validateRadix: validateRadix,
    validateInteger: validateInteger,
    toInteger: toInteger,
    validateFloat: validateFloat,
    toFloat: toFloat,
    validateURL: validateURL,
    toURL: toURL,
    toStringURL: toStringURL,
    toBoolean: toBoolean,
    validateEthAddress: validateEthAddress,
    validateEthPrivateKey: validateEthPrivateKey,
    toEthAddress: toEthAddress,
    toEthPrivateKey: toEthPrivateKey,
    verifyArgumentWithNonEmptyValue: verifyArgumentWithNonEmptyValue,
    verifyArgumentIsURL: verifyArgumentIsURL,
    verifyArgumentIsInteger: verifyArgumentIsInteger,
    verifyArgumentIsIntegerIpPortNumber: verifyArgumentIsIntegerIpPortNumber,
    verifyArgumentIsPathToExistingFile: verifyArgumentIsPathToExistingFile,
    verifyArgumentIsPathToExistingFolder: verifyArgumentIsPathToExistingFolder,
    verifyArgumentIsArrayOfIntegers: verifyArgumentIsArrayOfIntegers,
    ensure_starts_with_0x: ensure_starts_with_0x,
    remove_starting_0x: remove_starting_0x,
    inet_ntoa: inet_ntoa,
    ip_from_hex: ip_from_hex,
    private_key_2_public_key: private_key_2_public_key,
    public_key_2_account_address: public_key_2_account_address,
    private_key_2_account_address: private_key_2_account_address,
    is_numeric: is_numeric,
    parseMoneyUnitName: parseMoneyUnitName,
    parseMoneySpecToWei: parseMoneySpecToWei,
    fn_address_impl_: fn_address_impl_,
    compute_chain_id_from_schain_name: compute_chain_id_from_schain_name,
    w3provider_2_url: w3provider_2_url,
    w3_2_url: w3_2_url,
    extract_error_message: extract_error_message
}; // module.exports
