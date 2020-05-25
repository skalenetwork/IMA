<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE-IMA NPM module

Implements **SKALE Interchain Messaging Agent** APIs.

Typical usage:

    const IMA   = require( "../npms/skale-ima" );
    const cc    = IMA.cc;
    const log   = IMA.log;
    const w3mod = IMA.w3mod;
    let ethereumjs_tx     = IMA.ethereumjs_tx;
    let ethereumjs_wallet = IMA.ethereumjs_wallet;
    let ethereumjs_util   = IMA.ethereumjs_util;

All the **IMA** require externally pre-initialized **Web3** connections, ABI, contract and account description objects.

Mainnet and S-Chains should be pre initialized as following:

    let g_str_url_main_net = "http://127.0.0.1:8545";
    let g_str_url_s_chain  = "http://127.0.0.1:2231";
    let g_chain_id_main_net = "Mainnet";
    let g_chain_id_s_chain  = "id-S-chain";
    const g_w3http_main_net = new w3mod.providers.HttpProvider( g_str_url_main_net );
    const g_w3_main_net = new w3mod( g_w3http_main_net );
    const g_w3http_s_chain = new w3mod.providers.HttpProvider( g_str_url_s_chain );
    const g_w3_s_chain = new w3mod( g_w3http_s_chain );

The **joTrufflePublishResult_main_net** and **joTrufflePublishResult_s_chain** ABI description objects are ABIs loaded from **truffle**-generated files. They are used to initialize contract description objects:

    let g_jo_deposit_box            = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.deposit_box_abi,           joTrufflePublishResult_main_net.deposit_box_address           ); // only main net
    let g_jo_token_manager          = new g_w3_s_chain .eth.Contract( joTrufflePublishResult_s_chain .token_manager_abi,         joTrufflePublishResult_s_chain .token_manager_address         ); // only s-chain
    let g_jo_message_proxy_main_net = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.message_proxy_mainnet_abi, joTrufflePublishResult_main_net.message_proxy_mainnet_address );
    let g_jo_message_proxy_s_chain  = new g_w3_s_chain .eth.Contract( joTrufflePublishResult_s_chain .message_proxy_chain_abi,   joTrufflePublishResult_s_chain .message_proxy_chain_address   );

The following function registers new **S-Chain** on _Mainnet_ and vice versa:

    async function register_all() {
        var b1 = await IMA.register_s_chain_on_main_net(
            g_w3_main_net,
            g_jo_message_proxy_main_net,
            g_joAccount_main_net,
            g_chain_id_s_chain,
            tc_main_net
            );
        var b2 = await IMA.register_s_chain_in_deposit_box(
            g_w3_main_net,
            g_jo_deposit_box, // only main net
            g_joAccount_main_net,
            g_jo_token_manager, // only s-chain
            g_chain_id_s_chain,
            tc_main_net
            );
        var b3 = await IMA.register_main_net_depositBox_on_s_chain(
            g_w3_s_chain,
            g_jo_token_manager, // only s-chain
            g_jo_deposit_box, // only main net
            g_joAccount_s_chain,
            g_cid_s_chain,
            tc_s_chain
            );
        var b4 = b1 && b2 && b3;
        return b4;
    }

The following code demonstrates money transfer event processing:

    var b1 = await IMA.do_transfer( // main-net --> s-chain
        /**/ g_w3_main_net,
        g_jo_message_proxy_main_net,
        g_joAccount_main_net,
        g_w3_s_chain,
        g_jo_message_proxy_s_chain,
        /**/ g_joAccount_s_chain,
        g_chain_id_main_net,
        g_chain_id_s_chain,
        g_cid_main_net,
        g_cit_s_chain,
        null, // imaState.jo_deposit_box - for logs validation on mainnet
        jo_token_manager, // for logs validation on s-chain
        g_nTransferBlockSizeM2S,
        g_nMaxTransactionsM2S,
        g_nBlockAwaitDepthM2S,
        g_nBlockAgeM2S,
        fn_do_sign_messages_m2s, // fn_sign_messages or null
        tc_s_chain
        );
    var b2 = await IMA.do_transfer( // s-chain --> main-net
        /**/ g_w3_s_chain,
        g_jo_message_proxy_s_chain,
        g_joAccount_s_chain,
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        /**/ g_joAccount_main_net,
        g_chain_id_s_chain,
        g_chain_id_main_net,
        g_cid_s_chain,
        g_cid_main_net,
        imaState.jo_deposit_box, // for logs validation on mainnet
        null, // imaState.jo_token_manager, // for logs validation on s-chain
        g_nTransferBlockSizeS2M,
        g_nMaxTransactionsS2M,
        g_nBlockAwaitDepthS2M,
        g_nBlockAgeS2M,
        fn_do_sign_messages_s2m, // fn_sign_messages or null
        tc_main_net
        );

The following code demonstrates cross-chain payments:

    IMA.do_payment_from_main_net(
        g_w3_main_net,
        g_joAccount_main_net,
        g_joAccount_s_chain,
        g_jo_deposit_box, // only main net
        g_chain_id_s_chain,
        g_wei_amount // how much money to send
        );
    await IMA.do_payment_from_s_chain(
        g_w3_s_chain,
        g_joAccount_s_chain,
        g_joAccount_main_net,
        g_jo_token_manager, // only s-chain
        g_wei_amount // how much money to send
        );
