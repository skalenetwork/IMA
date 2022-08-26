require( "dotenv" ).config();
const endpoint = process.env.ENDPOINT;
const privateKey = process.env.PRIVATE_KEY;
const addressG = process.env.ADDRESS;
const ethereumjs_tx = require( "ethereumjs-tx" );
const crypto = require("crypto")

const Web3 = require( "web3" );

const web3 = new Web3( new Web3.providers.HttpProvider( endpoint ) );

const DIFFICULTY = new web3.utils.BN( 1 );

async function safe_send_signed_transaction( serializedTx ) {
    const strTX = "0x" + serializedTx.toString( "hex" ); // strTX is string starting from "0x"
    let joReceipt = null;
    let bHaveReceipt = false;
    try {
        joReceipt = await web3.eth.sendSignedTransaction( strTX );
        bHaveReceipt = ( joReceipt != null );
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "WARNING:" ) + cc.warning( " first attempt to send signed transaction failure during : " ) + cc.sunny( err ) + "\n";
    }
    if( !bHaveReceipt ) {
        try {
            joReceipt = await web3.eth.sendSignedTransaction( strTX );
        } catch ( err ) {
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " second attempt to send signed transaction failure during : " ) + cc.error( err ) + "\n";
            throw err;
        }
    }
    return joReceipt;
}

function mineFreeGas( gasAmount, address, nonce ) {
    console.log( "Mining free gas: ", gasAmount );
    const nonceHash = new web3.utils.BN( web3.utils.soliditySha3( nonce ).slice( 2 ), 16 );
    const addressHash = new web3.utils.BN( web3.utils.soliditySha3( address ).slice( 2 ), 16 );
    const nonceAddressXOR = nonceHash.xor( addressHash );
    const maxNumber = new web3.utils.BN( 2 ).pow( new web3.utils.BN( 256 ) ).sub( new web3.utils.BN( 1 ) );
    const divConstant = maxNumber.div( DIFFICULTY );
    let candidate;
    while( true ) {
        candidate = new web3.utils.BN( crypto.randomBytes( 32 ).toString( "hex" ), 16 );
        const candidateHash = new web3.utils.BN( web3.utils.soliditySha3( candidate ).slice( 2 ), 16 );
        const resultHash = nonceAddressXOR.xor( candidateHash );
        const externalGas = divConstant.div( resultHash ).toNumber();
        console.log(externalGas);
        if( externalGas >= gasAmount ) {
            break;
        }
    }
    return candidate.toString();
}

async function sendTX() {
    // const dataTx = "0x68eb2022000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000001";
    const dataTx = "0x";
    const tcnt = await web3.eth.getTransactionCount(web3.utils.toChecksumAddress(addressG));
    console.log("OK");
    const minedGasPrice = mineFreeGas( 100000, addressG, tcnt );
    const rawTx = {
        chainId: "0x79f99296",
        nonce: tcnt,
        gasPrice: minedGasPrice,
        // gasLimit: estimatedGas,
        gas: 100000, // gas is optional here
        to: "0xD2aAA00500000000000000000000000000000000", // contract address
        data: dataTx
    };
    const tx = new ethereumjs_tx( rawTx );
    const key = Buffer.from( privateKey, "hex" ); // convert private key to buffer
    tx.sign( key );
    const serializedTx = tx.serialize();
    await safe_send_signed_transaction(serializedTx);
}

sendTX();