
// introduction: https://github.com/Checkmarx/JS-SCP
// main PDF with rules to follow: https://www.gitbook.com/download/pdf/book/checkmarx/JS-SCP
// top 10 hit parade: https://owasp.org/www-project-top-ten/

const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );

const cc = require( "../skale-cc/cc.js" );
const w3mod = require( "web3" );
const ethereumjs_tx = require( "ethereumjs-tx" ).Transaction;
const ethereumjs_wallet = require( "ethereumjs-wallet" );
const ethereumjs_util = require( "ethereumjs-util" );

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
        : parseInt( radix );
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
            ( parseInt( Number( value ), radix ) == value || radix != 10 ) &&
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
        if( u.hostname.length == 0 )
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
        if( ethereumjs_util.isValidAddress( value ) )
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
        value = "" + ( value ? value.toString() : "" );
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
    if( ( !joArg.value ) || ( typeof joArg.value === "string" && joArg.value.length == 0 ) ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must not be empty" ) );
        process.exit( 666 );
    }
    return joArg;
}

function verifyArgumentIsURL( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const u = toURL( joArg.value );
        if( u == null ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
            process.exit( 666 );
        }
        if( u.hostname.length <= 0 ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
            process.exit( 666 );
        }
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
        process.exit( 666 );
    }
}

function verifyArgumentIsInteger( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        if( !validateInteger( joArg.value ) ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
            process.exit( 666 );
        }
        joArg.value = toInteger( joArg.value );
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
        process.exit( 666 );
    }
}

function verifyArgumentIsPathToExistingFile( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const stats = fs.lstatSync( joArg.value );
        if( stats.isDirectory() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing file, path to folder provided" ) );
            process.exit( 666 );
        }
        if( !stats.isFile() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing file, bad path provided" ) );
            process.exit( 666 );
        }
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing file" ) );
        process.exit( 666 );
    }
}

function verifyArgumentIsPathToExistingFolder( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const stats = fs.lstatSync( joArg.value );
        if( stats.isFile() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing folder, path to file provided" ) );
            process.exit( 666 );
        }
        if( !stats.isDirectory() ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing folder, bad path provided" ) );
            process.exit( 666 );
        }
        return joArg;
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) + cc.error( " must be path to existing folder" ) );
        process.exit( 666 );
    }
}

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

function provider2url( provider ) {
    try {
        if( provider == null || provider == undefined )
            return "<N/A>";
        if( "host" in provider && provider.host && typeof provider.host == "string" && provider.host.length > 0 )
            return "" + provider.host;
        if( "connection" in provider && provider.connection && typeof provider.connection == "object" &&
            "url" in provider.connection && provider.connection.url && typeof provider.connection.url == "string" && provider.connection.url.length > 0
        )
            return "" + provider.connection.url;
        if( "connection" in provider && provider.connection && typeof provider.connection == "object" &&
            "_url" in provider.connection && provider.connection._url && typeof provider.connection._url == "string" && provider.connection._url.length > 0
        )
            return "" + provider.connection.url;
    } catch ( err ) {
    }
    return "<unknown>";
}

function is_numeric( s ) {
    return /^\d+$/.test( s );
}

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
    "wi": "wei"
    // "w": "wei"
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

function parseMoneySpecToWei( w3, s, isThrowException ) {
    try {
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
    verifyArgumentIsPathToExistingFile: verifyArgumentIsPathToExistingFile,
    verifyArgumentIsPathToExistingFolder: verifyArgumentIsPathToExistingFolder,
    ensure_starts_with_0x: ensure_starts_with_0x,
    remove_starting_0x: remove_starting_0x,
    private_key_2_public_key: private_key_2_public_key,
    public_key_2_account_address: public_key_2_account_address,
    private_key_2_account_address: private_key_2_account_address,
    provider2url: provider2url,
    is_numeric: is_numeric,
    parseMoneySpecToWei: parseMoneySpecToWei
}; // module.exports
