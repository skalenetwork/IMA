
const assert = require('chai').assert;
const expect = require('chai').expect;
const MTA = require( "../../npms/skale-mta" );
// const w3 = require("web3")
const w3mod = MTA.w3mod

// 
let chain_id_s_chain = "blah_blah_blah_schain_name"; // 1;

// mockup for `w3_main_net`
let w3_main_net = {eth: {sendSignedTransaction: sendSignedTransaction, Contract: Contract,
    getTransactionCount: getTransactionCount}, 
    utils: {fromAscii: fromAscii, fromWei: fromWei, toBN: toBN, toHex: toHex, toWei: toWei}
};
// mockup for `w3_s_chain`
let w3_s_chain = {eth: {sendSignedTransaction: sendSignedTransaction, 
    getTransactionCount: getTransactionCount}, utils: {fromAscii: fromAscii}
};
function sendSignedTransaction(string) {
    return true
}
function getTransactionCount(string) {
    return 1
}
function fromAscii(string) {
    return "0"
}
function fromWei(string, string) {
    return "0"
}
function toBN(string) {
    return "0"
}
function Contract(string, string) {
    return {methods: {approve: approve}}
}
function approve(string, string) {
    return {encodeABI: encodeABI}
}
function toHex(string) {
    return "0x9a"
}
function toWei(string, string) {
    return 100
}

// mockup for `joAccountDst`
let joAccountDst = { address: fn_address_impl_, 
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joAccountSrc`
let joAccountSrc = { address: fn_address_impl_, 
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joAccount`
let joAccount = { address: fn_address_impl_, 
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joAccount_main_net`
let joAccount_main_net = { address: fn_address_impl_,
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
function fn_address_impl_( w3 ) {
    return "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f";
}

// mockup for `jo_deposit_box`
let jo_deposit_box = {methods: {deposit: deposit, depositERC20: depositERC20,
    rawDepositERC20: rawDepositERC20}, 
    options: {address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function deposit(string, string, string) {
    return {encodeABI: encodeABI}
}
function depositERC20(string, string, string, string) {
    return {encodeABI: encodeABI}
}
function rawDepositERC20(string, string, string, string, string) {
    return {encodeABI: encodeABI}
}

// mockup for `jo_message_proxy_main_net`
let jo_message_proxy_main_net = {methods: {isConnectedChain: isConnectedChain, addConnectedChain: addConnectedChain}, 
    options: {address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function isConnectedChain(string) {
    return {call: call}
}
function call({}) {
    return true
}
function addConnectedChain(string, []) {
    return {encodeABI: encodeABI}
}

// mockup for `jo_lock_and_data_main_net`
let jo_lock_and_data_main_net = {methods: {hasSchain: hasSchain, addSchain: addSchain, getMyEth: getMyEth,
    approveTransfers: approveTransfers}, 
    options: {address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function hasSchain(string) {
    return {call: call}
}
function approveTransfers(string) {
    return {call: call}
}
function addSchain(string, []) {
    return {encodeABI: encodeABI}
}
function getMyEth() {
    return {encodeABI: encodeABI}
}

// mockup for `jo_lock_and_data_s_chain`
let jo_lock_and_data_s_chain = {methods: {hasDepositBox: hasDepositBox, addDepositBox: addDepositBox}, 
    options: {address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function hasDepositBox() {
    return {call: call}
}
function addDepositBox(string) {
    return {encodeABI: encodeABI}
}
function encodeABI() {
    return "0x0"
}

// mockup for `jo_token_manager`
let jo_token_manager = {methods: {exitToMain: exitToMain}, 
    options: {address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"},
    getPastEvents: getPastEvents
};
function exitToMain(string) {
    return {encodeABI: encodeABI}
}
function getPastEvents(string, {}) {
    return "events stub"
}

describe('tests for `npms/skale-mta`', function () {

    it('should invoke `verbose_get`', async function () {
        expect(MTA.verbose_get()).to.equal("3");
    });

    it('should invoke `verbose_set`', async function () {
        MTA.verbose_set("0");
        expect(MTA.verbose_get()).to.equal("0");
    });

    it('should invoke `verbose_parse`', async function () {
        // return 5 by default
        expect(MTA.verbose_parse()).to.equal(5);
        // return 6 when `info` in parameters
        expect(MTA.verbose_parse("info")).to.equal("6");
    });

    it('should invoke `ensure_starts_with_0x`', async function () {
        let string = "123456789"
        expect(MTA.ensure_starts_with_0x(string)).to.be.equal("0x" + string);
    });

    it('should invoke `remove_starting_0x`', async function () {
        let string = "0x123456789"
        expect(MTA.remove_starting_0x(string)).to.be.equal(string.substr(2));
        // not string
        expect(MTA.remove_starting_0x(321)).to.be.equal(321);
        // short string less than 2
        expect(MTA.remove_starting_0x("1")).to.be.equal("1");
    });

    it('should invoke `private_key_2_public_key`', async function () {
        let keyPrivate = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
        let keyPrivateUnd; // undefined
        let w3modund; // undefined
        // if w3mod `undefined` or `null`
        expect(MTA.private_key_2_public_key(w3modund, keyPrivate)).to.be.empty;
        // if keyPrivate `undefined` or `null`
        expect(MTA.private_key_2_public_key(w3mod, keyPrivateUnd)).to.be.empty;
        // when all parameters is OK
        expect(MTA.private_key_2_public_key(w3mod, keyPrivate)).to.have.lengthOf(128);
    });

    it('should invoke `public_key_2_account_address`', async function () {
        let keyPublic = "5dd431d36ce6b88f27d351051b31a26848c4a886f0dd0bc87a7d5a9d821417c9" +
            "e807e8589f680ab0f2ab29831231ad7b3d6659990ee830582fede785fc3c33c4";
        let keyPublicUnd; // undefined
        let w3modund; // undefined
        // if w3mod `undefined` or `null`
        expect(MTA.public_key_2_account_address(w3modund, keyPublic)).to.be.empty;
        // if keyPrivate `undefined` or `null`
        expect(MTA.public_key_2_account_address(w3mod, keyPublicUnd)).to.be.empty;
        // when all parameters is OK
        expect(MTA.public_key_2_account_address(w3mod, keyPublic)).to.include("0x");
    });

    it('should invoke `private_key_2_account_address`', async function () {
        let keyPrivate = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
        //
        expect(MTA.private_key_2_account_address(w3mod, keyPrivate)).to.include("0x");
    });

    it('should return `false` invoke `check_is_registered_s_chain_on_main_net`', async function () {
        let jo_message_proxy_main_net = {};
        //
        expect(await MTA.
            check_is_registered_s_chain_on_main_net(
                w3_main_net,
                jo_message_proxy_main_net,
                joAccount_main_net,
                chain_id_s_chain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `check_is_registered_s_chain_on_main_net`', async function () {
        // 
        expect(await MTA.
            check_is_registered_s_chain_on_main_net(
                w3_main_net,
                jo_message_proxy_main_net,
                joAccount_main_net,
                chain_id_s_chain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `register_s_chain_on_main_net`', async function () {
        let w3_main_net; // for `false` output
        // 
        expect(await MTA.
            register_s_chain_on_main_net(
                w3_main_net,
                jo_message_proxy_main_net,
                joAccount_main_net,
                chain_id_s_chain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `register_s_chain_on_main_net`', async function () {
        // 
        expect(await MTA.
            register_s_chain_on_main_net(
                w3_main_net,
                jo_message_proxy_main_net,
                joAccount_main_net,
                chain_id_s_chain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `check_is_registered_s_chain_in_deposit_box`', async function () {
        let jo_lock_and_data_main_net; // for `false` output
        // 
        expect(await MTA.
            check_is_registered_s_chain_in_deposit_box(
                w3_main_net,
                jo_lock_and_data_main_net,
                joAccount_main_net,
                chain_id_s_chain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `check_is_registered_s_chain_in_deposit_box`', async function () {
        // 
        expect(await MTA.
            check_is_registered_s_chain_in_deposit_box(
                w3_main_net,
                jo_lock_and_data_main_net,
                joAccount_main_net,
                chain_id_s_chain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `register_s_chain_in_deposit_box`', async function () {
        let jo_lock_and_data_main_net; // for `false` output
        // 
        expect(await MTA.
            register_s_chain_in_deposit_box(
                w3_main_net,
                jo_lock_and_data_main_net,
                joAccount_main_net,
                jo_token_manager,
                chain_id_s_chain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `register_s_chain_in_deposit_box`', async function () {
        // 
        expect(await MTA.
            register_s_chain_in_deposit_box(
                w3_main_net,
                jo_lock_and_data_main_net,
                joAccount_main_net,
                jo_token_manager,
                chain_id_s_chain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `check_is_registered_main_net_depositBox_on_s_chain`', async function () {
        let jo_lock_and_data_s_chain; // for `false` output
        // 
        expect(await MTA.
            check_is_registered_main_net_depositBox_on_s_chain(
                w3_main_net,
                jo_lock_and_data_s_chain,
                joAccount
            )
        ).to.be.false;
    });

    it('should return `true` invoke `check_is_registered_main_net_depositBox_on_s_chain`', async function () {
        // 
        expect(await MTA.
            check_is_registered_main_net_depositBox_on_s_chain(
                w3_main_net,
                jo_lock_and_data_s_chain,
                joAccount
            )
        ).to.be.true;
    });

    it('should return `false` invoke `register_main_net_depositBox_on_s_chain`', async function () {
        let jo_deposit_box_main_net; // for `false` output
        // 
        expect(await MTA.
            register_main_net_depositBox_on_s_chain(
                w3_s_chain,
                jo_deposit_box_main_net,
                jo_lock_and_data_s_chain,
                joAccount
            )
        ).to.be.false;
    });

    it('should return `true` invoke `register_main_net_depositBox_on_s_chain`', async function () {
        let jo_deposit_box_main_net = {options: {address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}};
        // 
        expect(await MTA.
            register_main_net_depositBox_on_s_chain(
                w3_s_chain,
                jo_deposit_box_main_net,
                jo_lock_and_data_s_chain,
                joAccount
            )
        ).to.be.true;
    });

    it('should return `false` invoke `do_eth_payment_from_main_net`', async function () {
        let joAccountSrc, wei_how_much; // for `false` output
        // 
        expect(await MTA.
            do_eth_payment_from_main_net(
                w3_main_net,
                joAccountSrc,
                joAccountDst,
                jo_deposit_box,
                chain_id_s_chain,
                wei_how_much // how much WEI money to send
            )
        ).to.be.false;
    });

    it('should return `true` invoke `do_eth_payment_from_main_net`', async function () {
        let wei_how_much;
        // 
        expect(await MTA.
            do_eth_payment_from_main_net(
                w3_main_net,
                joAccountSrc,
                joAccountDst,
                jo_deposit_box,
                chain_id_s_chain,
                wei_how_much // how much WEI money to send
            )
        ).to.be.true;
    });

    it('should return `false` invoke `do_eth_payment_from_s_chain`', async function () {
        let joAccountSrc, wei_how_much; // for `false` output
        // 
        expect(await MTA.
            do_eth_payment_from_s_chain(
                w3_s_chain,
                joAccountSrc,
                joAccountDst,
                jo_token_manager,
                wei_how_much // how much WEI money to send
            )
        ).to.be.false;
    });

    it('should return `true` invoke `do_eth_payment_from_s_chain`', async function () {
        let wei_how_much;
        // 
        expect(await MTA.
            do_eth_payment_from_s_chain(
                w3_s_chain,
                joAccountSrc,
                joAccountDst,
                jo_token_manager,
                wei_how_much // how much WEI money to send
            )
        ).to.be.true;
    });

    it('should return `false` invoke `receive_eth_payment_from_s_chain_on_main_net`', async function () {
        let joAccount_main_net; // for `false` output
        // 
        expect(await MTA.
            receive_eth_payment_from_s_chain_on_main_net(
                w3_main_net,
                joAccount_main_net,
                jo_lock_and_data_main_net
            )
        ).to.be.false;
    });

    it('should return `true` invoke `receive_eth_payment_from_s_chain_on_main_net`', async function () {
        // 
        expect(await MTA.
            receive_eth_payment_from_s_chain_on_main_net(
                w3_main_net,
                joAccount_main_net,
                jo_lock_and_data_main_net
            )
        ).to.be.true;
    });

    it('should return `null` invoke `view_eth_payment_from_s_chain_on_main_net`', async function () {
        let joAccount_main_net; // for `false` output
        // 
        expect(await MTA.
            view_eth_payment_from_s_chain_on_main_net(
                w3_main_net,
                joAccount_main_net,
                jo_lock_and_data_main_net
            )
        ).to.be.null;
    });

    it('should return `true` invoke `view_eth_payment_from_s_chain_on_main_net`', async function () {
        // 
        expect(await MTA.
            view_eth_payment_from_s_chain_on_main_net(
                w3_main_net,
                joAccount_main_net,
                jo_lock_and_data_main_net
            )
        ).to.be.true;
    });

    it('should return `false` invoke `do_erc20_payment_from_main_net`', async function () {
        let token_amount;
        let strCoinNameErc20_main_net;
        let erc20PrivateTestnetJson_main_net;
        let strCoinNameErc20_s_chain;
        let erc20PrivateTestnetJson_s_chain;
        let isRawTokenTransfer = true;
        // 
        expect(await MTA.
            do_erc20_payment_from_main_net(
                w3_main_net,
                w3_s_chain,
                joAccountSrc,
                joAccountDst,
                jo_deposit_box,
                chain_id_s_chain,
                token_amount, // how much ERC20 tokens to send
                jo_token_manager, // only s-chain
                strCoinNameErc20_main_net,
                erc20PrivateTestnetJson_main_net,
                strCoinNameErc20_s_chain,
                erc20PrivateTestnetJson_s_chain,
                isRawTokenTransfer
            )
        ).to.be.false;
    });

    it('should return `true` invoke `do_erc20_payment_from_main_net`', async function () {
        let token_amount = "123";
        let strCoinNameErc20_main_net = "test";
        let erc20PrivateTestnetJson_main_net = {test_abi: "0x0", 
            test_address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"};
        let strCoinNameErc20_s_chain = "test";
        let erc20PrivateTestnetJson_s_chain = {test_abi: "0x0", 
            test_address: "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"};
        let isRawTokenTransfer = false;
        // 
        expect(await MTA.
            do_erc20_payment_from_main_net(
                w3_main_net,
                w3_s_chain,
                joAccountSrc,
                joAccountDst,
                jo_deposit_box,
                chain_id_s_chain,
                token_amount, // how much ERC20 tokens to send
                jo_token_manager, // only s-chain
                strCoinNameErc20_main_net,
                erc20PrivateTestnetJson_main_net,
                strCoinNameErc20_s_chain,
                erc20PrivateTestnetJson_s_chain,
                isRawTokenTransfer
            )
        ).to.be.true;
    });
});