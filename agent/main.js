
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self-signed wss and https

// const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );
const IMA = require( "../npms/skale-ima" );
const owaspUtils = IMA.owaspUtils;
const imaUtils = require( "./utils.js" );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
const log = imaUtils.log;
const cc = imaUtils.cc;
// const w3mod = IMA.w3mod;
const imaCLI = require( "./cli.js" );
const imaBLS = require( "./bls.js" );
const rpcCall = require( "./rpc-call.js" );
rpcCall.init( cc, log, owaspUtils );
// let ethereumjs_tx = IMA.ethereumjs_tx;
// let ethereumjs_wallet = IMA.ethereumjs_wallet;
// let ethereumjs_util = IMA.ethereumjs_util;

function fn_address_impl_( w3 ) {
    if( this.address_ == undefined || this.address_ == null ) {
        this.address_ = "" + owaspUtils.private_key_2_account_address( w3, this.privateKey );
    }
    return this.address_;
}

const imaState = {
    "strLogFilePath": "",
    "nLogMaxSizeBeforeRotation": -1,
    "nLogMaxFilesCount": -1,

    "bIsNeededCommonInit": true,
    "bSignMessages": false, // use BLS message signing, turned on with --sign-messages
    "joSChainNetworkInfo": null, // scanned S-Chain network description
    "strPathBlsGlue": "", // path to bls_glue app, must have if --sign-messages specified
    "strPathHashG1": "", // path to hash_g1 app, must have if --sign-messages specified
    "strPathBlsVerify": "", // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

    // TO-DO: the next ABI JSON should contain main-net only contract info - S-chain contract addresses must be downloaded from S-chain
    "joTrufflePublishResult_main_net": { },
    "joTrufflePublishResult_s_chain": { },

    "joErc20_main_net": null,
    "joErc20_s_chain": null,

    "strAddrErc20_explicit": "",
    "strCoinNameErc20_main_net": "", // in-JSON coin name
    "strCoinNameErc20_s_chain": "", // in-JSON coin name

    "joErc721_main_net": null,
    "joErc721_s_chain": null,
    "strAddrErc721_explicit": "",
    "strCoinNameErc721_main_net": "", // in-JSON coin name
    "strCoinNameErc721_s_chain": "", // in-JSON coin name

    // deposit_box_address           --> deposit_box_abi
    // token_manager_address         --> token_manager_abi
    // message_proxy_mainnet_address --> message_proxy_mainnet_abi
    // message_proxy_chain_address   --> message_proxy_chain_abi

    "strPathAbiJson_main_net": imaUtils.normalizePath( "../proxy/data/proxyMainnet.json" ), // "./abi_main_net.json"
    "strPathAbiJson_s_chain": imaUtils.normalizePath( "../proxy/data/proxySchain.json" ), // "./abi_s_chain.json"

    "bShowConfigMode": false, // true - just show configuration values and exit

    "strURL_main_net": owaspUtils.toStringURL( process.env.URL_W3_MAIN_NET ), // example: "http://127.0.0.1:8545"
    "strURL_s_chain": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN ), // example: "http://127.0.0.1:2231"

    "strChainID_main_net": ( process.env.CHAIN_NAME_MAINNET || "Mainnet" ).toString().trim(),
    "strChainID_s_chain": ( process.env.CHAIN_NAME_SCHAIN || "id-S-chain" ).toString().trim(),
    "cid_main_net": owaspUtils.toInteger( process.env.CID_MAINNET ) || -4,
    "cid_s_chain": owaspUtils.toInteger( process.env.CID_SCHAIN ) || -4,

    "strPathJsonErc20_main_net": "",
    "strPathJsonErc20_s_chain": "",

    "strPathJsonErc721_main_net": "",
    "strPathJsonErc721_s_chain": "",

    "nAmountOfWei": 0, // 1000000000000000000
    "nAmountOfToken": 0,
    "idToken": 0,
    "isRawTokenTransfer": true,
    "isRawTokenTransfer_EXPLICIT": false,

    "nTransferBlockSizeM2S": 10,
    "nTransferBlockSizeS2M": 10,
    "nMaxTransactionsM2S": 0,
    "nMaxTransactionsS2M": 0,

    "nBlockAwaitDepthM2S": 0,
    "nBlockAwaitDepthS2M": 0,
    "nBlockAgeM2S": 0,
    "nBlockAgeS2M": 0,

    "nLoopPeriodSeconds": 10,

    "nNodeNumber": 0, // S-Chain node number(zero based)
    "nNodesCount": 1,
    "nTimeFrameSeconds": 0, // 0-disable, 60-recommended
    "nNextFrameGap": 10,

    //
    //

    "w3http_main_net": null,
    "w3_main_net": null,

    "w3http_s_chain": null,
    "w3_s_chain": null,

    "jo_deposit_box": null, // only main net
    "jo_token_manager": null, // only s-chain
    "jo_message_proxy_main_net": null,
    "jo_message_proxy_s_chain": null,
    "jo_lock_and_data_main_net": null,
    "jo_lock_and_data_s_chain": null,
    // "eth_erc721": null, // only s-chain
    "eth_erc20": null, // only s-chain

    //
    // examples of valid values:
    //
    // "joAccount_main_net": { "name": "g3",    "privateKey": "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc", "address": fn_address_impl_ }, // "address": "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
    // "joAccount_s_chain ": { "name": "Bob",   "privateKey": "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e", "address": fn_address_impl_ }, // "address": "0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852"
    //
    // "joAccount_main_net": { "name": "g2",    "privateKey": "39cb49d82f7e20ad26f2863f74de198f7d5be3aa9b3ec58fbd641950da30acd8", "address": fn_address_impl_ }, // "address": "0x6595b3d58c80db0cc6d50ca5e5f422e6134b07a8"
    // "joAccount_s_chain ": { "name": "Alice", "privateKey": "1800d6337966f6410905a6bf9af370ac2f55c7428854d995cfa719e061ac0dca", "address": fn_address_impl_ }, // "address": "0x651054E818a0E022Bbb681Aa3b657386f20845F5"
    //
    // "joAccount_main_net": { "name": "g1",    "privateKey": "2a95a383114492b90a6eecbc355d7b63501ffb72ed39a788e48aa3c286eb526d", "address": fn_address_impl_ }, // "address": "0x12b907ebaea975ce4d5de010cdf680ad21dc4ca1"
    // "joAccount_s_chain ": { "name": "Alex",  "privateKey": "d47f07804006486dbeba6b81e50fc93543657853a3d2f736d4fd68488ca94c17", "address": fn_address_impl_ }, // "address": "0x8e8311f4c4533f4C19363d6140e1D5FA16Aa4071"
    //
    // example of empty values to fill from command line arguments:
    //
    // "joAccount_main_net": { "privateKey": "", "address": fn_address_impl_ },
    // "joAccount_s_chain": { "privateKey": "", "address": fn_address_impl_ },
    //
    "joAccount_main_net": { "privateKey": owaspUtils.toEthPrivateKey( process.env.INSECURE_PRIVATE_KEY_FOR_MAINNET ), "address": fn_address_impl_ },
    "joAccount_s_chain": { "privateKey": owaspUtils.toEthPrivateKey( process.env.INSECURE_PRIVATE_KEY_FOR_SCHAIN ), "address": fn_address_impl_ },

    //
    //

    "arrActions": [] // array of actions to run
};

const tmp_address_MN_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_MAINNET );
const tmp_address_SC_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN );
if( tmp_address_MN_from_env && typeof tmp_address_MN_from_env == "string" && tmp_address_MN_from_env.length > 0 ) {
    imaState.joAccount_main_net.address_ = "" + tmp_address_MN_from_env;
}
if( tmp_address_SC_from_env && typeof tmp_address_SC_from_env == "string" && tmp_address_SC_from_env.length > 0 ) {
    imaState.joAccount_s_chain.address_ = "" + tmp_address_SC_from_env;
}

imaBLS.init( IMA, imaState, imaUtils, log, cc, rpcCall, owaspUtils );

imaCLI.init( IMA, imaState, imaUtils, log, cc, rpcCall, owaspUtils );
imaCLI.parse( {
    "register": function() {
        imaState.arrActions.push( {
            "name": "Full registration(all steps)",
            "fn": async function() {
                return await register_all();
            }
        } );
    },
    "register1": function() {
        imaState.arrActions.push( {
            "name": "Registration step 1, register S-Chain on Main-net",
            "fn": async function() {
                return await register_step1();
            }
        } );
    },
    "register2": function() {
        imaState.arrActions.push( {
            "name": "Registration step 2, register S-Chain in deposit box",
            "fn": async function() {
                return await register_step2();
            }
        } );
    },
    "register3": function() {
        imaState.arrActions.push( {
            "name": "Registration step 3, register Main-net deposit box on S-Chain",
            "fn": async function() {
                return await register_step3();
            }
        } );
    },
    "check-registration": function() {
        imaState.arrActions.push( {
            "name": "Full registration status check(all steps)",
            "fn": async function() {
                const b = await check_registration_all();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
    },
    "check-registration1": function() {
        imaState.arrActions.push( {
            "name": "Registration status check for step 1, register S-Chain on Main-net",
            "fn": async function() {
                const b = await check_registration_step1();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
    },
    "check-registration2": function() {
        imaState.arrActions.push( {
            "name": "Registration status check step 2, register S-Chain in deposit box",
            "fn": async function() {
                const b = await check_registration_step2();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
    },
    "check-registration3": function() {
        imaState.arrActions.push( {
            "name": "Registration status check step 3, register Main-net deposit box on S-Chain",
            "fn": async function() {
                const b = await check_registration_step3();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
    },
    "m2s-payment": function() {
        imaState.arrActions.push( {
            "name": "one M->S single payment",
            "fn": async function() {
                if( imaState.strCoinNameErc721_main_net.length > 0
                // && imaState.strCoinNameErc721_s_chain.length > 0
                ) {
                    // ERC721 payment
                    log.write( cc.info( "one M->S single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.jo_lock_and_data_main_net, // for checking logs
                        imaState.strChainID_s_chain,
                        imaState.idToken, // which ERC721 token id to send
                        imaState.jo_token_manager, // only s-chain
                        imaState.strCoinNameErc721_main_net,
                        imaState.joErc721_main_net,
                        imaState.strCoinNameErc721_s_chain,
                        imaState.joErc721_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                if( imaState.strCoinNameErc20_main_net.length > 0
                // && imaState.strCoinNameErc20_s_chain.length > 0
                ) {
                    // ERC20 payment
                    log.write( cc.info( "one M->S single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.jo_lock_and_data_main_net, // for checking logs
                        imaState.strChainID_s_chain,
                        imaState.nAmountOfToken, // how much ERC20 tokens to send
                        imaState.jo_token_manager, // only s-chain
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                // ETH payment
                log.write( cc.info( "one M->S single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_main_net(
                    imaState.w3_main_net,
                    imaState.cid_main_net,
                    imaState.joAccount_main_net,
                    imaState.joAccount_s_chain,
                    imaState.jo_deposit_box, // only main net
                    imaState.jo_message_proxy_main_net, // for checking logs
                    imaState.jo_lock_and_data_main_net, // for checking logs
                    imaState.strChainID_s_chain,
                    imaState.nAmountOfWei // how much WEI money to send
                );
            }
        } );
    },
    "s2m-payment": function() {
        imaState.arrActions.push( {
            "name": "one S->M single payment",
            "fn": async function() {
                if( imaState.strCoinNameErc721_s_chain.length > 0 ) {
                    // ERC721 payment
                    log.write( cc.info( "one S->M single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box, // only main net
                        imaState.idToken, // which ERC721 token id to send
                        imaState.strCoinNameErc721_main_net,
                        imaState.joErc721_main_net,
                        imaState.strCoinNameErc721_s_chain,
                        imaState.joErc721_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                if( imaState.strCoinNameErc20_s_chain.length > 0 ) {
                    // ERC20 payment
                    log.write( cc.info( "one S->M single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box, // only main net
                        imaState.nAmountOfToken, // how ERC20 tokens money to send
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                // ETH payment
                log.write( cc.info( "one S->M single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_s_chain(
                    imaState.w3_s_chain,
                    imaState.cid_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.joAccount_main_net,
                    imaState.jo_token_manager, // only s-chain
                    imaState.jo_message_proxy_s_chain, // for checking logs
                    imaState.nAmountOfWei // how much WEI money to send
                );
            }
        } );
    },
    "s2m-receive": function() {
        imaState.arrActions.push( {
            "name": "receive one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "receive one S->M single ETH payment: " ) + "\n" ); // just print value
                return await IMA.receive_eth_payment_from_s_chain_on_main_net(
                    imaState.w3_main_net,
                    imaState.cid_main_net,
                    imaState.joAccount_main_net,
                    imaState.jo_lock_and_data_main_net
                );
            }
        } );
    },
    "s2m-view": function() {
        imaState.arrActions.push( {
            "name": "view one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "view one S->M single ETH payment: " ) + "\n" ); // just print value
                const xWei = await IMA.view_eth_payment_from_s_chain_on_main_net(
                    imaState.w3_main_net,
                    imaState.joAccount_main_net,
                    imaState.jo_lock_and_data_main_net
                );
                if( xWei === null || xWei === undefined ) {
                    return false;
                }
                const xEth = imaState.w3_main_net.utils.fromWei( xWei, "ether" );
                log.write( cc.success( "Main-net user can receive: " ) + cc.attention( xWei ) + cc.success( " wei = " ) + cc.attention( xEth ) + cc.success( " eth" ) + "\n" );
                return true;
            }
        } );
    },
    "m2s-transfer": function() {
        imaState.arrActions.push( {
            "name": "single M->S transfer loop",
            "fn": async function() {
                return await IMA.do_transfer( // main-net --> s-chain
                    //
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    imaState.joAccount_main_net,
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    //
                    imaState.joAccount_s_chain,
                    imaState.strChainID_main_net,
                    imaState.strChainID_s_chain,
                    imaState.cid_main_net,
                    imaState.cid_s_chain,
                    null, // imaState.jo_deposit_box, // for logs validation on mainnet
                    imaState.jo_token_manager, // for logs validation on s-chain
                    imaState.nTransferBlockSizeM2S,
                    imaState.nMaxTransactionsM2S,
                    imaState.nBlockAwaitDepthM2S,
                    imaState.nBlockAgeM2S,
                    imaBLS.do_sign_messages_m2s // fn_sign_messages
                );
            }
        } );
    },
    "s2m-transfer": function() {
        imaState.arrActions.push( {
            "name": "single S->M transfer loop",
            "fn": async function() {
                return await IMA.do_transfer( // s-chain --> main-net
                    //
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    //
                    imaState.joAccount_main_net,
                    imaState.strChainID_s_chain,
                    imaState.strChainID_main_net,
                    imaState.cid_s_chain,
                    imaState.cid_main_net,
                    imaState.jo_deposit_box, // for logs validation on mainnet
                    null, // imaState.jo_token_manager - for logs validation on s-chain
                    imaState.nTransferBlockSizeS2M,
                    imaState.nMaxTransactionsS2M,
                    imaState.nBlockAwaitDepthS2M,
                    imaState.nBlockAgeS2M,
                    imaBLS.do_sign_messages_s2m // fn_sign_messages
                );
            }
        } );
    },
    "transfer": function() {
        imaState.arrActions.push( {
            "name": "Single M<->S transfer loop iteration",
            "fn": async function() {
                return await single_transfer_loop();
            }
        } );
    },
    "loop": function() {
        imaState.arrActions.push( {
            "name": "M<->S transfer loop",
            "fn": async function() {
                if( !await check_registration_step1() ) {
                    if( !await register_step1() ) {
                        return false;
                    }
                }
                if( !await check_registration_step2() ) {
                    if( !await register_step2() ) {
                        return false;
                    }
                }
                if( !await check_registration_step3() ) {
                    if( !await register_step3() ) {
                        return false;
                    }
                }
                return await run_transfer_loop();
            }
        } );
    },
    "browse-s-chain": function() {
        imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Brows S-Chain network",
            "fn": async function() {
                const strLogPrefix = cc.info( "S Browse:" ) + " ";
                if( imaState.strURL_s_chain.length == 0 ) {
                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing S-Chain URL, please specify " ) + cc.info( "url-s-chain" ) );
                    process.exit( 501 );
                }
                log.write( strLogPrefix + cc.normal( "Downloading S-Chain network information " ) + cc.normal( "..." ) + "\n" ); // just print value
                //
                await rpcCall.create( imaState.strURL_s_chain, async function( joCall, err ) {
                    if( err ) {
                        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                        process.exit( 1 );
                    }
                    await joCall.call( {
                        "method": "skale_nodesRpcInfo",
                        "params": { }
                    }, async function( joIn, joOut, err ) {
                        if( err ) {
                            console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                            process.exit( 1 );
                        }
                        log.write( strLogPrefix + cc.normal( "S-Chain network information: " ) + cc.j( joOut.result ) + "\n" );
                        let nCountReceivedImaDescriptions = 0;
                        const jarrNodes = joOut.result.network;
                        for( let i = 0; i < jarrNodes.length; ++ i ) {
                            const joNode = jarrNodes[i];
                            const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                            await rpcCall.create( strNodeURL, async function( joCall, err ) {
                                if( err ) {
                                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                                    process.exit( 1 );
                                }
                                await joCall.call( {
                                    "method": "skale_imaInfo",
                                    "params": { }
                                }, function( joIn, joOut, err ) {
                                    ++ nCountReceivedImaDescriptions;
                                    if( err ) {
                                        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                                        process.exit( 1 );
                                    }
                                    log.write( strLogPrefix + cc.normal( "Node " ) + cc.info( joNode.nodeID ) + cc.normal( " IMA information: " ) + cc.j( joOut.result ) + "\n" );
                                    //process.exit( 0 );
                                } );
                            } );
                        }
                        //process.exit( 0 );
                        const iv = setInterval( function() {
                            if( nCountReceivedImaDescriptions == jarrNodes.length ) {
                                clearInterval( iv );
                                process.exit( 0 );
                            }
                        }, 100 );
                    } );
                } );
                return true;
            }
        } );
    }
} );

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if( imaState.strLogFilePath.length > 0 ) {
    log.write( cc.debug( "Will print message to file " ) + cc.info( imaState.strLogFilePath ) + "\n" );
    log.add( imaState.strLogFilePath, imaState.nLogMaxSizeBeforeRotation, imaState.nLogMaxFilesCount );
}

if( imaState.bIsNeededCommonInit ) {
    imaCLI.ima_common_init();
}

if( imaState.bShowConfigMode ) {
    // just show configuration values and exit
    process.exit( 0 );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function discover_s_chain_network( fnAfter ) {
    const strLogPrefix = cc.info( "S net discover:" ) + " ";
    fnAfter = fnAfter || function() {};
    let joSChainNetworkInfo = null;
    await rpcCall.create( imaState.strURL_s_chain, async function( joCall, err ) {
        if( err ) {
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed: " ) + cc.warning( err ) + "\n" );
            fnAfter( err, null );
            return;
        }
        await joCall.call( {
            "method": "skale_nodesRpcInfo",
            "params": { }
        }, async function( joIn, joOut, err ) {
            if( err ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) + "\n" );
                fnAfter( err, null );
                return;
            }
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace ) {
                log.write( strLogPrefix + cc.normal( "OK, got S-Chain network information: " ) + cc.j( joOut.result ) + "\n" );
            } else if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                log.write( strLogPrefix + cc.success( "OK, got S-Chain network information." ) + "\n" );
            }
            let nCountReceivedImaDescriptions = 0;
            joSChainNetworkInfo = joOut.result;
            const jarrNodes = joSChainNetworkInfo.network;
            for( let i = 0; i < jarrNodes.length; ++ i ) {
                const joNode = jarrNodes[i];
                const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                await rpcCall.create( strNodeURL, function( joCall, err ) {
                    if( err ) {
                        log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                        fnAfter( err, null );
                        return;
                    }
                    joCall.call( {
                        "method": "skale_imaInfo",
                        "params": { }
                    }, function( joIn, joOut, err ) {
                        ++ nCountReceivedImaDescriptions;
                        if( err ) {
                            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) + "\n" );
                            fnAfter( err, null );
                            return;
                        }
                        //if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                        //    log.write( strLogPrefix + cc.normal( "Node ") + cc.info(joNode.nodeID) + cc.normal(" IMA information: " ) + cc.j( joOut.result ) + "\n" );
                        joNode.imaInfo = joOut.result;
                        //joNode.joCall = joCall;
                        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                            log.write( strLogPrefix + cc.success( "OK, got node " ) + cc.info( joNode.nodeID ) + cc.success( " IMA information(" ) + cc.info( nCountReceivedImaDescriptions ) + cc.success( " of " ) + cc.info( jarrNodes.length ) + cc.success( ")." ) + "\n" );
                        }
                    } );
                } );
            }
            // process.exit( 0 );
            const iv = setInterval( function() {
                if( nCountReceivedImaDescriptions == jarrNodes.length ) {
                    clearInterval( iv );
                    fnAfter( null, joSChainNetworkInfo );
                }
            }, 100 );
        } );
    } );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// register S-Chain 1 on main net
//
async function do_the_job() {
    const strLogPrefix = cc.info( "Job 1:" ) + " ";
    let idxAction = 0;
    const cntActions = imaState.arrActions.length;
    let cntFalse = 0;
    let cntTrue = 0;
    for( idxAction = 0; idxAction < cntActions; ++idxAction ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        }
        const joAction = imaState.arrActions[idxAction];
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug ) {
            log.write( strLogPrefix + cc.notice( "Will execute action:" ) + " " + cc.info( joAction.name ) + cc.debug( " (" ) + cc.info( idxAction + 1 ) + cc.debug( " of " ) + cc.info( cntActions ) + cc.debug( ")" ) + "\n" );
        }
        try {
            if( await joAction.fn() ) {
                ++cntTrue;
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                    log.write( strLogPrefix + cc.success( "Succeeded action:" ) + " " + cc.info( joAction.name ) + "\n" );
                }
            } else {
                ++cntFalse;
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.error ) {
                    log.write( strLogPrefix + cc.warning( "Failed action:" ) + " " + cc.info( joAction.name ) + "\n" );
                }
            }
        } catch ( e ) {
            ++cntFalse;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR: Exception occurred while executing action:" ) + " " + cc.info( joAction.name ) + cc.error( ", error description: " ) + cc.warning( e ) + "\n" );
            }
        }
    } // for( idxAction = 0; idxAction < cntActions; ++ idxAction )
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        log.write( strLogPrefix + cc.info( "FINISH:" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntActions ) + cc.notice( " task(s) executed" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntTrue ) + cc.success( " task(s) succeeded" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntFalse ) + cc.error( " task(s) failed" ) + "\n" );
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
    }
    if( cntFalse > 0 ) {
        process.exitCode = cntFalse;
    }
}

if( imaState.bSignMessages ) {
    if( imaState.strPathBlsGlue.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " please specify --bls-glue parameter." ) + "\n" );
        process.exit( 666 );
    }
    if( imaState.strPathHashG1.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " please specify --hash-g1 parameter." ) + "\n" );
        process.exit( 666 );
    }
    discover_s_chain_network( function( err, joSChainNetworkInfo ) {
        if( err ) {
            process.exit( 1 ); // error information is printed by discover_s_chain_network()
        }
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( cc.success( "S-Chain network was discovered: " ) + cc.j( joSChainNetworkInfo ) + "\n" );
        imaState.joSChainNetworkInfo = joSChainNetworkInfo;
        do_the_job();
        return 0; // FINISH
    } );
} else {
    do_the_job();
    // process.exit( 0 ); // FINISH (skip exit here to avoid early termination while tasks ase still running)
}

async function register_step1() {
    const strLogPrefix = cc.info( "Reg 1:" ) + " ";
    const bRetVal1A = await IMA.register_s_chain_on_main_net( // step 1A
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain,
        imaState.cid_main_net
    );
    const bRetVal1B = await IMA.register_main_net_on_s_chain( // step 1B
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net,
        imaState.cid_s_chain
    );
    const bRetVal = ( bRetVal1A && bRetVal1B ) ? true : false;
    if( !bRetVal ) {
        const nRetCode = 1501;
        log.write( strLogPrefix + cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " failed to register S-Chain on Main-net, will return code " ) + cc.warning( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_step2() {
    const strLogPrefix = cc.info( "Reg 2:" ) + " ";
    const bRetVal = await IMA.register_s_chain_in_deposit_box( // step 2
        imaState.w3_main_net,
        // imaState.jo_deposit_box - only main net
        imaState.jo_lock_and_data_main_net,
        imaState.joAccount_main_net,
        imaState.jo_token_manager, // only s-chain
        imaState.strChainID_s_chain,
        imaState.cid_main_net
    );
    if( !bRetVal ) {
        const nRetCode = 1502;
        log.write( strLogPrefix + cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " failed to register S-Chain in deposit box, will return code " ) + cc.warning( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_step3() {
    const strLogPrefix = cc.info( "Reg 3:" ) + " ";
    const bRetVal = await IMA.register_main_net_depositBox_on_s_chain( // step 3
        imaState.w3_s_chain,
        // imaState.jo_token_manager - only s-chain
        imaState.jo_deposit_box, // only main net
        imaState.jo_lock_and_data_s_chain,
        imaState.joAccount_s_chain,
        imaState.cid_s_chain
    );
    if( !bRetVal ) {
        const nRetCode = 1503;
        log.write( strLogPrefix + cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " failed to register Main-net deposit box on S-Chain, will return code " ) + cc.warning( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_all() {
    if( !await register_step1() ) {
        return false;
    }
    if( !await register_step2() ) {
        return false;
    }
    if( !await register_step3() ) {
        return false;
    }
    return true;
}

async function check_registration_all() {
    const b1 = await check_registration_step1();
    const b2 = await check_registration_step2();
    const b3 = await check_registration_step3();
    if( !( b1 && b2 && b3 ) ) {
        return false;
    }
    return true;
}
async function check_registration_step1() {
    const bRetVal1A = await IMA.check_is_registered_s_chain_on_main_net( // step 1A
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
    );
    const bRetVal1B = await IMA.check_is_registered_main_net_on_s_chain( // step 1B
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net
    );
    const bRetVal = ( bRetVal1A && bRetVal1B ) ? true : false;
    return bRetVal;
}
async function check_registration_step2() {
    const bRetVal = await IMA.check_is_registered_s_chain_in_deposit_box( // step 2
        imaState.w3_main_net,
        imaState.jo_lock_and_data_main_net,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
    );
    return bRetVal;
}
async function check_registration_step3() {
    const bRetVal = await IMA.check_is_registered_main_net_depositBox_on_s_chain( // step 3
        imaState.w3_s_chain,
        imaState.jo_lock_and_data_s_chain,
        imaState.joAccount_s_chain
    );
    return bRetVal;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run transfer loop
//

function check_time_framing( d ) {
    try {
        if( imaState.nTimeFrameSeconds <= 0 || imaState.nNodesCount <= 1 ) {
            return true; // time framing is disabled
        }
        if( d == null || d == undefined ) {
            d = new Date(); // now
        }
        const nUtcUnixTimeStamp = Math.floor( d.valueOf() / 1000 ); // Unix UTC timestamp, see https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        const nSecondsRangeForAllSChains = imaState.nTimeFrameSeconds * imaState.nNodesCount;
        const nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        const nActiveNodeFrameIndex = Math.floor( nMod / imaState.nTimeFrameSeconds );
        let bSkip = ( nActiveNodeFrameIndex != imaState.nNodeNumber ) ? true : false;
        let bInsideGap = false;
        if( !bSkip ) {
            const nRangeStart = nUtcUnixTimeStamp - Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
            const nFrameStart = nRangeStart + imaState.nNodeNumber * imaState.nTimeFrameSeconds;
            const nGapStart = nFrameStart + imaState.nTimeFrameSeconds - imaState.nNextFrameGap;
            if( nUtcUnixTimeStamp >= nGapStart ) {
                bSkip = true;
                bInsideGap = true;
            }
        }
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace ) {
            log.write(
                "\n" +
                cc.info( "Unix UTC time stamp" ) + cc.debug( "........" ) + cc.notice( nUtcUnixTimeStamp ) + "\n" +
                cc.info( "All Chains Range" ) + cc.debug( "..........." ) + cc.notice( nSecondsRangeForAllSChains ) + "\n" +
                cc.info( "S-Chain Range Mod" ) + cc.debug( ".........." ) + cc.notice( nMod ) + "\n" +
                cc.info( "Active Node Frame Index" ) + cc.debug( "...." ) + cc.notice( nActiveNodeFrameIndex ) + "\n" +
                cc.info( "Testing Frame Index" ) + cc.debug( "........" ) + cc.notice( imaState.nNodeNumber ) + "\n" +
                cc.info( "Is skip" ) + cc.debug( "...................." ) + cc.yn( bSkip ) + "\n" +
                cc.info( "Is inside gap" ) + cc.debug( ".............." ) + cc.yn( bInsideGap ) + "\n"
            );
        }
        if( bSkip ) {
            return false;
        }
    } catch ( e ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal ) {
            log.write( cc.fatal( "Exception in check_time_framing():" ) + cc.error( e ) + "\n" );
        }
    }
    return true;
}

async function single_transfer_loop() {
    const strLogPrefix = cc.attention( "Single Loop:" ) + " ";
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
    }
    if( !check_time_framing() ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug ) {
            log.write( strLogPrefix + cc.warning( "Skipped due to time framing" ) + "\n" );
        }
        return true;
    }
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( "Will invoke M2S transfer..." ) + "\n" );
    }
    const b1 = await IMA.do_transfer( // main-net --> s-chain
        //
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        //
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net,
        imaState.strChainID_s_chain,
        imaState.cid_main_net,
        imaState.cid_s_chain,
        null, // imaState.jo_deposit_box - for logs validation on mainnet
        imaState.jo_token_manager, // for logs validation on s-chain
        imaState.nTransferBlockSizeM2S,
        imaState.nMaxTransactionsM2S,
        imaState.nBlockAwaitDepthM2S,
        imaState.nBlockAgeM2S,
        imaBLS.do_sign_messages_m2s // fn_sign_messages
    );
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf( b1 ) + "\n" );
    }
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
    }
    const b2 = await IMA.do_transfer( // s-chain --> main-net
        //
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        //
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain,
        imaState.strChainID_main_net,
        imaState.cid_s_chain,
        imaState.cid_main_net,
        imaState.jo_deposit_box, // for logs validation on mainnet
        null, // imaState.jo_token_manager, // for logs validation on s-chain
        imaState.nTransferBlockSizeS2M,
        imaState.nMaxTransactionsS2M,
        imaState.nBlockAwaitDepthS2M,
        imaState.nBlockAgeS2M,
        imaBLS.do_sign_messages_s2m // fn_sign_messages
    );
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf( b2 ) + "\n" );
    }
    const b3 = b1 && b2;
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf( b3 ) + "\n" );
    }
    return b3;
}
async function single_transfer_loop_with_repeat() {
    await single_transfer_loop();
    setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
};
async function run_transfer_loop( isDelayFirstRun ) {
    isDelayFirstRun = owaspUtils.toBoolean( isDelayFirstRun );
    if( isDelayFirstRun ) {
        setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
    } else {
        await single_transfer_loop_with_repeat();
    }
    return true;
}
