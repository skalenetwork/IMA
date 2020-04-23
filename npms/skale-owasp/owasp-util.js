

// introduction: https://github.com/Checkmarx/JS-SCP
// main PDF with rules to follow: https://www.gitbook.com/download/pdf/book/checkmarx/JS-SCP
// top 10 hit parade: https://owasp.org/www-project-top-ten/

let url = require( "url" );
const cc = require( "../skale-cc/cc.js" );
const w3mod = require( "web3" );
let ethereumjs_tx = require( "ethereumjs-tx" ).Transaction;
let ethereumjs_wallet = require( "ethereumjs-wallet" );
let ethereumjs_util = require( "ethereumjs-util" );

function rxIsInt(val) {
    try {
        let intRegex = /^-?\d+$/;
        if( ! intRegex.test( val ) )
            return false;
        let intVal = parseInt( val, 10 );
        if( parseFloat( val ) == intVal && (! isNaN( intVal ) ) )
            return true;
    } catch( err ) {
    }
    return false;
}

function rxIsFloat( val ) {
    try {
        let floatRegex = /^-?\d+(?:[.,]\d*?)?$/;
        if( ! floatRegex.test( val ) )
            return false;
        val = parseFloat( val );
        if( isNaN( val ) )
            return false;
        return true;
    } catch( err ) {
    }
    return false;
}

function validateRadix( value, radix ) {
    value = "" + value.toString();
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
        if(     (! isNaN( value ) )
            &&  ( parseInt( Number( value ), radix ) == value || radix != 10 )
            &&  (! isNaN( parseInt( value, radix ) ) )
            )
            return true;
    } catch( err ) {
    }
    return false;
}

function toInteger( value, radix ) {
    try {
        radix = validateRadix( value, radix );
        if( ! validateInteger( value, radix ) )
            return NaN;
        return parseInt( value, radix )
    } catch( err ) {
    }
    return false;
}

function validateFloat( value ) {
    try {
            let f = parseFloat( value );
        if( isNaN( f ) )
            return false;
        return true;
    } catch( err ) {
    }
    return false;
}

function toFloat( value ) {
    try {
        let f = parseFloat( value );
        return f;
    } catch( err ) {
    }
    return false;
}

function validateURL( s ) {
    let u = toURL( s );
    if( u == null )
        return false;
    return true;
}

function toURL( s ) {
	try {
        if( s == null || s == undefined )
            return null;
        if( typeof s != "string" )
            return null;
        s = s.trim();
        if( s.length <= 0 )
            return null;
		let sc = s[0];
		if( sc == "\"" || sc == "'" ) {
			let cnt = s.length;
			if( s[cnt-1] == sc ) {
				let ss = s.substring( 1, cnt-1 );
				let u = toURL( ss );
				if( u != null && u != undefined )
					u.strStrippedStringComma = sc;
				return u;
			}
			return null;
		}
		let u = url.parse( s );
		if( ! u.hostname )
			return null;
		if( u.hostname.length == 0 )
			return null;
		u.strStrippedStringComma = null;
		return u;
	} catch( e ) {
		return null;
	}
}

// see https://ethereum.stackexchange.com/questions/1374/how-can-i-check-if-an-ethereum-address-is-valid
function validateEthAddress( value ) {
    if( ethereumjs_util.isValidAddress( value ) )
        return true;
    return false;
}

// see https://gist.github.com/miguelmota/20fcd7c5c2604907dcbba749ea3f1e8c
function validateEthPrivateKey( value ) {
    if( ethereumjs_util.isValidPrivate( value ) )
        return true;
    return false;
}

function verifyArgumentWithNonEmptyValue( joArg ) {
    if( ( !joArg.value ) || ( typeof joArg.value == "string" && joArg.value.length == 0 ) ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value of argument " ) + cc.info( joArg.name ) + cc.error( " must not be empty" ) );
        process.exit( 666 );
    }
}

function verifyArgumentIsURL( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        let u = toURL( joArg.value );
        if( u == null ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
            process.exit( 666 );
        }
        if( u.hostname.length <= 0 ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
            process.exit( 666 );
        }
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid URL" ) );
        process.exit( 666 );
    }
}

function verifyArgumentIsInteger( joArg ) {
    try {
        verifyArgumentWithNonEmptyValue( joArg );
        if( ! validateInteger( joArg.value ) ) {
            console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
            process.exit( 666 );
        }
        joArg.value = toInteger( joArg.value );
    } catch ( err ) {
        console.log( cc.fatal( "(OWASP) CRITICAL ERROR:" ) + cc.error( " value of argument " ) + cc.info( joArg.name ) + cc.error( " must be valid integer" ) );
        process.exit( 666 );
    }
}

function verifyArgumentAsBoolean( joArg ) {
    let b = false;
    try {
        if( typeof joArg.value == "string" ) {
            let ch = joArg.value[ 0 ].toLowerCase();
            if ( ch == "y" || ch == "t" )
                b = true
            else if( validateInteger( joArg.value) )
                b = toInteger( joArg.value ) ? true : false;
            else if( validateFloat( joArg.value) )
                b = toFloat( joArg.value ) ? true : false;
            else
                b = !!b;
        } else
            b = !!b;
    } catch ( err ) {
        b = false;
    }
    joArg.value = b ? true : false;
    return b;
}

module.exports = {
    "cc": cc
    , "w3mod": w3mod
    , "ethereumjs_tx": ethereumjs_tx
    , "ethereumjs_wallet": ethereumjs_wallet
    , "ethereumjs_util": ethereumjs_util
    , "rxIsInt": rxIsInt
    , "rxIsFloat": rxIsFloat
    , "validateRadix": validateRadix
    , "validateInteger": validateInteger
    , "toInteger": toInteger
    , "validateFloat": validateFloat
    , "toFloat": toFloat
    , "validateURL": validateURL
    , "toURL": toURL
    , "validateEthAddress": validateEthAddress
    , "validateEthPrivateKey": validateEthPrivateKey
    , "verifyArgumentWithNonEmptyValue": verifyArgumentWithNonEmptyValue
    , "verifyArgumentIsURL": verifyArgumentIsURL
    , "verifyArgumentIsInteger": verifyArgumentIsInteger
    , "verifyArgumentAsBoolean": verifyArgumentAsBoolean
}; // module.exports
