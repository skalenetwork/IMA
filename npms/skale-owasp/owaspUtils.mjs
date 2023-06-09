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
 * @file owaspUtils.mjs
 * @copyright SKALE Labs 2019-Present
 */

// introduction: https://github.com/Checkmarx/JS-SCP
// main PDF with rules to follow:
//     https://www.gitbook.com/download/pdf/book/checkmarx/JS-SCP
// top 10 hit parade: https://owasp.org/www-project-top-ten/

import * as ethersMod from "ethers";
import * as fs from "fs";
import * as cc from "../skale-cc/cc.mjs";
import * as ethereumJsUtilModule from "ethereumjs-util";
import * as ethereumJsWalletModule from "ethereumjs-wallet";
const Wallet = ethereumJsWalletModule.default.default;

const safeURL = cc.safeURL;
const replaceAll = cc.replaceAll;

export { ethersMod, safeURL, replaceAll };

export function rxIsInt( val ) {
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

export function rxIsFloat( val ) {
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

export function parseIntOrHex( s ) {
    if( typeof s != "string" )
        return parseInt( s );
    s = s.trim();
    if( s.length > 2 && s[0] == "0" && ( s[1] == "x" || s[1] == "X" ) )
        return parseInt( s, 16 );
    return parseInt( s, 10 );
}

export function validateRadix( value, radix ) {
    value = "" + ( value ? value.toString() : "10" );
    value = value.trim();
    radix = ( radix == null || radix == undefined )
        ? ( ( value.length > 2 && value[0] == "0" && ( value[1] == "x" || value[1] == "X" ) )
            ? 16 : 10 )
        : parseInt( radix, 10 );
    return radix;
}

export function validateInteger( value, radix ) {
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

export function toInteger( value, radix ) {
    try {
        radix = validateRadix( value, radix );
        if( !validateInteger( value, radix ) )
            return NaN;
        return parseInt( value, radix );
    } catch ( err ) {
    }
    return false;
}

export function validateFloat( value ) {
    try {
        const f = parseFloat( value );
        if( isNaN( f ) )
            return false;
        return true;
    } catch ( err ) {
    }
    return false;
}

export function toFloat( value ) {
    try {
        const f = parseFloat( value );
        return f;
    } catch ( err ) {
    }
    return false;
}

export function validateURL( s ) {
    const u = toURL( s );
    if( u == null )
        return false;
    return true;
}

export function toURL( s ) {
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

export function toStringURL( s, defValue ) {
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

export function isUrlHTTP( strURL ) {
    try {
        if( !validateURL( strURL ) )
            return false;
        const u = new URL( strURL );
        if( u.protocol == "http:" || u.protocol == "https:" )
            return true;
    } catch ( err ) {
    }
    return false;
}

export function isUrlWS( strURL ) {
    try {
        if( !validateURL( strURL ) )
            return false;
        const u = new URL( strURL );
        if( u.protocol == "ws:" || u.protocol == "wss:" )
            return true;
    } catch ( err ) {
    }
    return false;
}

export function toBoolean( value ) {
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

export function validateInputAddresses( address ) {
    return ( /^(0x){1}[0-9a-fA-F]{40}$/i.test( address ) );
}

export function validateEthAddress( value ) {
    try {
        if( validateInputAddresses( ensureStartsWith0x( value ) ) )
            return true;
    } catch ( err ) {
    }
    return false;
}

export function validateEthPrivateKey( value ) {
    try {
        const ethersWallet = new ethersMod.ethers.Wallet( ensureStartsWith0x( value ) );
        if( ethersWallet.address )
            return true;
    } catch ( err ) {
    }
    return false;
}

export function toEthAddress( value, defValue ) {
    try {
        value = "" + ( value ? ensureStartsWith0x( value.toString() ) : "" );
        defValue = defValue || "";
        if( !validateEthAddress( value ) )
            return defValue;
    } catch ( err ) {
    }
    return value;
}

export function toEthPrivateKey( value, defValue ) {
    try {
        value = "" + ( value ? value.toString() : "" );
        defValue = defValue || "";
        if( !validateEthPrivateKey( value ) )
            return defValue;
    } catch ( err ) {
    }
    return value;
}

export function verifyArgumentWithNonEmptyValue( joArg ) {
    if( ( !joArg.value ) || ( typeof joArg.value === "string" && joArg.value.length === 0 ) ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
            cc.error( " must not be empty" )
        );
        process.exit( 126 );
    }
    return joArg;
}

export function verifyArgumentIsURL( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const u = toURL( joArg.value );
        if( u == null ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be valid URL" )
            );
            process.exit( 126 );
        }
        if( u.hostname.length <= 0 ) {
            console.log( cc.fatal(
                "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) + cc.warning( joArg.value ) +
                cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be valid URL" )
            );
            process.exit( 126 );
        }
        return joArg;
    } catch ( err ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
            cc.error( " must be valid URL" )
        );
        process.exit( 126 );
    }
}

export function verifyArgumentIsInteger( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        if( !validateInteger( joArg.value ) ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be valid integer" )
            );
            process.exit( 126 );
        }
        joArg.value = toInteger( joArg.value );
        return joArg;
    } catch ( err ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
            cc.error( " must be valid integer" )
        );
        process.exit( 126 );
    }
}

export function verifyArgumentIsIntegerIpPortNumber( joArg ) {
    try {
        verifyArgumentIsInteger( joArg );
        if( joArg.value < 0 )
            throw new Error( "Port number " + joArg.value + " cannot be negative" );
        if( joArg.value < 1 )
            throw new Error( "Port number " + joArg.value + " too small" );
        if( joArg.value > 65535 )
            throw new Error( "Port number " + joArg.value + " too big" );
        return joArg;
    } catch ( err ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
            cc.error( " must be valid integer IP port number" )
        );
        process.exit( 126 );
    }
}

export function verifyArgumentIsPathToExistingFile( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const stats = fs.lstatSync( joArg.value );
        if( stats.isDirectory() ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be path to existing file, path to folder provided" )
            );
            process.exit( 126 );
        }
        if( !stats.isFile() ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be path to existing file, bad path provided" )
            );
            process.exit( 126 );
        }
        return joArg;
    } catch ( err ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
            cc.error( " must be path to existing file" )
        );
        process.exit( 126 );
    }
}

export function verifyArgumentIsPathToExistingFolder( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        const stats = fs.lstatSync( joArg.value );
        if( stats.isFile() ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) +
                cc.info( joArg.name ) +
                cc.error( " must be path to existing folder, path to file provided" )
            );
            process.exit( 126 );
        }
        if( !stats.isDirectory() ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be path to existing folder, bad path provided" )
            );
            process.exit( 126 );
        }
        return joArg;
    } catch ( err ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) +
            cc.info( joArg.name ) + cc.error( " must be path to existing folder" )
        );
        process.exit( 126 );
    }
}

export function verifyArgumentIsArrayOfIntegers( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        if( joArg.value.length < 3 ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " length " ) +
                cc.warning( joArg.value.length ) + cc.error( " of argument " ) +
                cc.info( joArg.name ) + cc.error( " must be bigger than 2" )
            );
            process.exit( 126 );
        }
        if( joArg.value[0] !== "[" || joArg.value[joArg.value.length - 1] !== "]" ) {
            console.log(
                cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " first and last symbol " ) +
                cc.warning( joArg.value ) + cc.error( " of argument " ) + cc.info( joArg.name ) +
                cc.error( " must be brackets" )
            );
            process.exit( 126 );
        }
        const newValue = joArg.value.replace( "[", "" ).replace( "]", "" ).split( "," );
        for( let index = 0; index < newValue.length; index++ ) {
            if( !newValue[index] ||
                ( typeof newValue[index] === "string" && newValue[index].length === 0 )
            ) {
                console.log(
                    cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                    cc.warning( newValue[index] ) + cc.error( " of argument " ) +
                    cc.info( joArg.name ) + cc.error( " must not be empty" )
                );
                process.exit( 126 );
            }
            if( !validateInteger( newValue[index] ) ) {
                console.log(
                    cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
                    cc.warning( newValue[index] ) + cc.error( " of argument " ) +
                    cc.info( joArg.name ) + cc.error( " must be valid integer" )
                );
                process.exit( 126 );
            }
            newValue[index] = toInteger( newValue[index] );
        }
        return newValue;
    } catch ( err ) {
        console.log(
            cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value " ) +
            cc.warning( joArg.value ) + cc.error( " of argument " ) +
            cc.info( joArg.name ) + cc.error( " must be valid integer array" )
        );
        process.exit( 126 );
    }
}

export function ensureStartsWith0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return "0x" + s;
    if( s[0] == "0" && s[1] == "x" )
        return s;
    return "0x" + s;
}

export function removeStarting0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return s;
    if( s[0] == "0" && s[1] == "x" )
        return s.substr( 2 );
    return s;
}

export function inetNtoA( n ) {
    const a = ( ( n >> 24 ) & 0xFF ) >>> 0;
    const b = ( ( n >> 16 ) & 0xFF ) >>> 0;
    const c = ( ( n >> 8 ) & 0xFF ) >>> 0;
    const d = ( n & 0xFF ) >>> 0;
    return ( a + "." + b + "." + c + "." + d );
}

export function ipFromHex( hex ) {
    return inetNtoA( parseInt( removeStarting0x( hex ), 16 ) );
}

export function cloneObjectByRootKeys( joIn ) {
    const joOut = { }, arrKeys = Object.keys( joIn );
    for( let i = 0; i < arrKeys.length; ++ i ) {
        const key = arrKeys[i];
        const value = joIn[key];
        joOut[key] = value;
    }
    return joOut;
}

// example: "1ether" -> "1000000000000000000"
// supported suffix aliases, lowercase
const gMapMoneyNameSuffixAliases = {
    "ethe": "ether",
    "ethr": "ether",
    "eth": "ether",
    "eter": "ether",
    "ete": "ether",
    "et": "ether",
    "eh": "ether",
    "er": "ether",
    "finne": "finney",
    "finn": "finney",
    "fin": "finney",
    "fn": "finney",
    "fi": "finney",
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
    "we": "wei",
    "wi": "wei",

    // next are advanced kind of
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

export function parseMoneyUnitName( s ) {
    s = s.trim().toLowerCase();
    if( s == "" )
        return "wei";
    if( s in gMapMoneyNameSuffixAliases ) {
        s = gMapMoneyNameSuffixAliases[s];
        return s;
    }
    return s;
}

function moneyUnitNameToEthersParseSpec( s ) {
    switch ( s.toString().trim().toLowerCase() ) {
    case "shannon": return 9;
    case "lovelace": return 6;
    case "babbage": return 3;
    case "femtoether": return "ether";
    case "picoether": return "ether";
    case "nanoether": return "ether";
    case "microether": return "ether";
    case "milliether": return "ether";
    case "kether": return "ether";
    case "mether": return "ether";
    case "gether": return "ether";
    case "tether": return "ether";
    }
    return s;
}

function moneyUnitNameToPostDivider( s ) {
    switch ( s.toString().trim().toLowerCase() ) {
    case "femtoether": return "1000000000000000";
    case "picoether": return "1000000000000";
    case "nanoether": return "1000000000";
    case "microether": return "1000000";
    case "milliether": return "1000";
    }
    return null;
}
function moneyUnitNameToPostMultiplier( s ) {
    switch ( s.toString().trim().toLowerCase() ) {
    case "kether": return "1000";
    case "mether": return "1000000";
    case "gether": return "1000000000";
    case "tether": return "1000000000000";
    }
    return null;
}

export function parseMoneySpecToWei( s, isThrowException ) {
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
            if( /^\d+$/.test( chr ) || // is numeric
                chr == "."
            ) {
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
        const ddr = moneyUnitNameToPostDivider( s ),
            mlr = moneyUnitNameToPostMultiplier( s );
        s = moneyUnitNameToEthersParseSpec( s );
        s = ethersMod.ethers.utils.parseUnits( strNumber, s );
        if( ddr != null )
            s = s.div( toBN( ddr ) );
        if( mlr != null )
            s = s.mul( toBN( mlr ) );
        s = s.toString();
        return s;
    } catch ( err ) {
        if( isThrowException ) {
            throw new Error(
                "Parse error in parseMoneySpecToWei(\"" + s +
                "\"), error is: " + err.toString() );
        }
    }
    return "0";
}

export function computeChainIdFromSChainName( strName ) {
    let h = ethersMod.ethers.utils.id( strName );
    h = removeStarting0x( h ).toLowerCase();
    while( h.length < 64 )
        h = "0" + h;
    h = h.substr( 0, 14 );
    return ensureStartsWith0x( h );
}

export function privateKeyToAccountAddress( keyPrivate ) {
    return ethersMod.ethers.utils.computeAddress(
        ensureStartsWith0x( keyPrivate ) );
}

export function privateKeyToPublicKey( keyPrivate ) {
    const privateKeyBuffer =
    ethereumJsUtilModule.toBuffer( ensureStartsWith0x( keyPrivate ) );
    const wallet = Wallet.fromPrivateKey( privateKeyBuffer );
    const publicKey = wallet.getPublicKeyString();
    return removeStarting0x( publicKey );
}

export function publicKeyToAccountAddress( keyPublic ) {
    const hash = ethersMod.ethers.utils.keccak256( ensureStartsWith0x( keyPublic ) );
    const strAddress = ensureStartsWith0x( hash.substr( hash.length - 40 ) );
    return strAddress;
}

export function fnAddressImpl_() {
    if( this.address_ == undefined || this.address_ == null || this.address_ == "" ) {
        if( this.privateKey )
            this.address_ = "" + privateKeyToAccountAddress( this.privateKey );
    }
    return this.address_;
}

export function getEthersProviderFromURL( strURL ) {
    const joConnectionInfo = { // see https://docs.ethers.io/v5/api/utils/web/#ConnectionInfo
        url: strURL,
        allowInsecureAuthentication: true
    };
    const ethersProvider = new ethersMod.ethers.providers.JsonRpcProvider( joConnectionInfo );
    return ethersProvider;
}

export function ethersProviderToUrl( ethersProvider ) {
    let strURL = null;
    if( ethersProvider &&
        "connection" in ethersProvider && typeof ethersProvider.connection == "object" &&
        "url" in ethersProvider.connection && typeof ethersProvider.connection.url == "string"
    )
        strURL = "" + ethersProvider.connection.url;
    return strURL;
}

export function ensureObserverOptionsInitialized( opts ) {
    if( ! opts )
        throw new Error( "IMA observer options is not valid JS object" );
    if( ! ( "imaState" in opts && opts.imaState && typeof opts.imaState == "object" ) )
        throw new Error( "IMA observer options does not contain \"imaState\" instance" );
    if( ! ( "joAbiSkaleManager" in opts.imaState &&
        opts.imaState.joAbiSkaleManager &&
        typeof opts.imaState.joAbiSkaleManager == "object" )
    )
        throw new Error( "IMA observer options does not contain \"joAbiSkaleManager\" instance" );
    const arrContractNames = [
        { abiKey: "schains", nameKey: "SChains" },
        { abiKey: "schains_internal", nameKey: "SChainsInternal" },
        { abiKey: "nodes", nameKey: "Nodes" }
    ];
    for( let i = 0; i < arrContractNames.length; ++ i ) {
        const strAbiSuffixName = arrContractNames[i].abiKey;
        const strPropertySuffixName = arrContractNames[i].nameKey;
        const strPropertyName = "jo" + strPropertySuffixName;
        const contractAddress = opts.imaState.joAbiSkaleManager[strAbiSuffixName + "_address"];
        const joContractABI = opts.imaState.joAbiSkaleManager[strAbiSuffixName + "_abi"];
        opts[strPropertyName] =
            new ethersMod.ethers.Contract(
                contractAddress,
                joContractABI,
                opts.imaState.chainProperties.mn.ethersProvider
            );
    }
}

export function extractErrorMessage( jo, strDefaultErrorText ) {
    strDefaultErrorText = strDefaultErrorText || "unknown error or error without a description";
    try {
        const isError = function( err ) {
            return err && err.stack && err.message;
        };
        if( ! isError( jo ) ) {
            if( "error" in jo ) {
                jo = jo.error;
                if( typeof jo == "string" )
                    return jo;
                if( typeof jo != "object" )
                    return strDefaultErrorText + "(" + jo.toString() + ")";
            }
            if( typeof jo == "string" && jo )
                return strDefaultErrorText + "(" + jo.toString() + ")";
            return strDefaultErrorText;
        }
        if( typeof jo.message == "string" && jo.message.length > 0 )
            return jo.message; // + jo.stack;
        strDefaultErrorText += "(" + jo.toString() + ")"; // + jo.stack;
    } catch ( err ) {
    }
    return strDefaultErrorText;
}

export function toBN( x ) {
    const bn = ethersMod.ethers.BigNumber.from( x );
    return bn;
}

export function isNumeric( s ) {
    return /^\d+$/.test( s );
}
