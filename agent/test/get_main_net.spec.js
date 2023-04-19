// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file get_main_net.spec.js
 * @copyright SKALE Labs 2019-Present
 */

const assert = require('chai').assert;
const expect = require('chai').expect;
const IMA = require( "../../npms/skale-ima" );
const w3mod = IMA.w3mod
const transactionCustomizerMainNet = IMA.getTransactionCustomizerForMainNet();
const transactionCustomizerSChain = IMA.getTransactionCustomizerForSChain();

// 
let chainIdSChain = "blah_blah_blah_schain_name"; // 1;

// mockup for `ethersProviderSrc`
let ethersProviderSrc = {eth: {getBlockNumber: getBlockNumber, getBlock: getBlock}};
function getBlockNumber(string) {
    return 2
}
function getBlock(number) {
    return {timestamp: "1469021581"}
}

// mockup for `ethersProviderDst`
let ethersProviderDst = {eth: {sendSignedTransaction: sendSignedTransaction,
    getTransactionCount: getTransactionCount}, 
    utils: {hexToAscii: hexToAscii, asciiToHex: asciiToHex}
};
function hexToAscii(string) {
    return "0"
}
function asciiToHex(string) {
    return "0x0"
}

// mockup for `ethersProviderMainNet`
let ethersProviderMainNet = {eth: {sendSignedTransaction: sendSignedTransaction, Contract: Contract,
    getTransactionCount: getTransactionCount}, 
    utils: {fromAscii: fromAscii, fromWei: fromWei, toBN: toBN, toHex: toHex, toWei: toWei}
};
// mockup for `ethersProviderSChain`
let ethersProviderSChain = {eth: {sendSignedTransaction: sendSignedTransaction, Contract: Contract,
    getTransactionCount: getTransactionCount}, 
    utils: {fromAscii: fromAscii, fromWei: fromWei, toBN: toBN, toHex: toHex, toWei: toWei}
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
    return { "methods": { "approve": approve}}
}
function approve(string, string) {
    return { "encodeABI": encodeABI}
}
function toHex(string) {
    return "0x9a"
}
function toWei(string, string) {
    return 100
}

// mockup for `joAccountDst`
let joAccountDst = { "address": IMA.owaspUtils.fnAddressImpl_, 
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joAccountSrc`
let joAccountSrc = { "address": IMA.owaspUtils.fnAddressImpl_, 
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joAccount`
let joAccount = { "address": IMA.owaspUtils.fnAddressImpl_, 
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joMainNetAccount`
let joMainNetAccount = { "address": IMA.owaspUtils.fnAddressImpl_,
    privateKey: "6270720ecca0185a979b6791bea433e9dbf23345e5b5b1b0258b1fbaf32b4390",
};
// mockup for `joDepositBox`
let joDepositBox = { "methods": {deposit: deposit, depositERC20: depositERC20,
    rawDepositERC20: rawDepositERC20}, 
    options: { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function deposit(string, string, string) {
    return { "encodeABI": encodeABI}
}
function depositERC20(string, string, string, string) {
    return { "encodeABI": encodeABI}
}
function rawDepositERC20(string, string, string, string, string) {
    return { "encodeABI": encodeABI}
}

// mockup for `joMessageProxyMainNet`
let joMessageProxyMainNet = { "methods": {isConnectedChain: isConnectedChain, addConnectedChain: addConnectedChain}, 
    options: { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function isConnectedChain(string) {
    return { "call": call}
}
function call({}) {
    return true
}
function addConnectedChain(string) {
    return { "encodeABI": encodeABI}
}

// mockup for `joLockAndDataMainNet`
let joLockAndDataMainNet = { "methods": {hasSchain: hasSchain, addSchain: addSchain, getMyEth: getMyEth,
    approveTransfers: approveTransfers}, 
    options: { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function hasSchain(string) {
    return { "call": call}
}
function approveTransfers(string) {
    return { "call": call}
}
function addSchain(string, []) {
    return { "encodeABI": encodeABI}
}
function getMyEth() {
    return { "encodeABI": encodeABI}
}

// mockup for `joLockAndDataSChain`
let joLockAndDataSChain = { "methods": {hasDepositBox: hasDepositBox, addDepositBox: addDepositBox}, 
    options: { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function hasDepositBox() {
    return { "call": call}
}
function addDepositBox(string) {
    return { "encodeABI": encodeABI}
}
function encodeABI() {
    return "0x0"
}

// mockup for `joMessageProxyDst`
let joMessageProxyDst = { "methods": {getIncomingMessagesCounter: getIncomingMessagesCounter,
    postIncomingMessages: postIncomingMessages},
    options: { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}
};
function getIncomingMessagesCounter(string) {
    return { "call": callNum}
}
function postIncomingMessages(string, {}) {
    return { "encodeABI": encodeABI}
}

// mockup for `joMessageProxySrc`
let joMessageProxySrc = { "methods": {getOutgoingMessagesCounter: getOutgoingMessagesCounter},
    getPastEvents: getPastEvents
};
function getOutgoingMessagesCounter(string) {
    return { "call": callNum}
}
function callNum() {
    return 3
}

// mockup for `joTokenManager`
let joTokenManager = { "methods": {exitToMain: exitToMain, exitToMainERC20: exitToMainERC20,
    rawExitToMainERC20: rawExitToMainERC20}, 
    options: { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"},
    getPastEvents: getPastEvents
};
function exitToMain(string) {
    return { "encodeABI": encodeABI}
}
function getPastEvents(string, {}) {
    return "events stub"
}
function rawExitToMainERC20(string, {}) {
    return { "encodeABI": encodeABI}
}
function exitToMainERC20(string, {}) {
    return { "encodeABI": encodeABI}
}

describe('tests for `npms/skale-ima`', function () {

    it('should invoke `verboseGet`', async function () {
        expect(IMA.verboseGet()).to.equal("3");
    });

    it('should invoke `verboseSet`', async function () {
        IMA.verboseSet("0");
        expect(IMA.verboseGet()).to.equal("0");
    });

    it('should invoke `verboseParse`', async function () {
        // return 5 by default
        expect(IMA.verboseParse()).to.equal(5);
        // return 6 when `info` in parameters
        expect(IMA.verboseParse("info")).to.equal("6");
    });

    it('should invoke `ensureStartsWith0x`', async function () {
        let string = "123456789"
        expect(IMA.owaspUtils.ensureStartsWith0x(string)).to.be.equal( "0" + "x" + string );
    });

    it('should invoke `removeStarting0x`', async function () {
        let string = "0x123456789"
        expect(IMA.owaspUtils.removeStarting0x(string)).to.be.equal(string.substr(2));
        // not string
        expect(IMA.owaspUtils.removeStarting0x(321)).to.be.equal(321);
        // short string less than 2
        expect(IMA.owaspUtils.removeStarting0x("1")).to.be.equal("1");
    });

    it('should invoke `privateKeyToPublicKey`', async function () {
        let keyPrivate = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
        let keyPrivateUnd; // undefined
        let w3mod_undefined; // undefined
        // if w3mod `undefined` or `null`
        expect(IMA.owaspUtils.privateKeyToPublicKey(w3mod_undefined, keyPrivate)).to.be.empty;
        // if keyPrivate `undefined` or `null`
        expect(IMA.owaspUtils.privateKeyToPublicKey(w3mod, keyPrivateUnd)).to.be.empty;
        // when all parameters is OK
        expect(IMA.owaspUtils.privateKeyToPublicKey(w3mod, keyPrivate)).to.have.lengthOf(128);
    });

    it('should invoke `publicKeyToAccountAddress`', async function () {
        let keyPublic = "5dd431d36ce6b88f27d351051b31a26848c4a886f0dd0bc87a7d5a9d821417c9" +
            "e807e8589f680ab0f2ab29831231ad7b3d6659990ee830582fede785fc3c33c4";
        let keyPublicUnd; // undefined
        // if keyPrivate `undefined` or `null`
        expect(IMA.owaspUtils.publicKeyToAccountAddress(keyPublicUnd)).to.be.empty;
        // when all parameters is OK
        expect(IMA.owaspUtils.publicKeyToAccountAddress(keyPublic)).to.include("0x");
    });

    it('should invoke `privateKeyToAccountAddress`', async function () {
        let keyPrivate = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
        expect( IMA.owaspUtils.privateKeyToAccountAddress( keyPrivate ) ).to.include("0x");
    });

    it('should return `false` invoke `check_is_registered_s_chain_in_deposit_box`', async function () {
        let joLockAndDataMainNet; // for `false` output
        expect(await IMA.
            check_is_registered_s_chain_in_deposit_box(
                ethersProviderMainNet,
                joLockAndDataMainNet,
                joMainNetAccount,
                chainIdSChain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `check_is_registered_s_chain_in_deposit_box`', async function () {
        expect(await IMA.
            check_is_registered_s_chain_in_deposit_box(
                ethersProviderMainNet,
                joLockAndDataMainNet,
                joMainNetAccount,
                chainIdSChain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `register_s_chain_in_deposit_box`', async function () {
        let joLockAndDataMainNet; // for `false` output
        expect(await IMA.
            register_s_chain_in_deposit_box(
                ethersProviderMainNet,
                joLockAndDataMainNet,
                joMainNetAccount,
                joTokenManager,
                chainIdSChain,
                transactionCustomizerMainNet
            )
        ).to.be.false;
    });

    it('should return `true` invoke `register_s_chain_in_deposit_box`', async function () {
        expect(await IMA.
            register_s_chain_in_deposit_box(
                ethersProviderMainNet,
                joLockAndDataMainNet,
                joMainNetAccount,
                joTokenManager,
                chainIdSChain,
                transactionCustomizerMainNet
            )
        ).to.be.true;
    });

    it('should return `false` invoke `check_is_registered_main_net_depositBox_on_s_chain`', async function () {
        let joLockAndDataSChain; // for `false` output
        expect(await IMA.
            check_is_registered_main_net_depositBox_on_s_chain(
                ethersProviderMainNet,
                joLockAndDataSChain,
                joAccount
            )
        ).to.be.false;
    });

    it('should return `true` invoke `check_is_registered_main_net_depositBox_on_s_chain`', async function () {
        expect(await IMA.
            check_is_registered_main_net_depositBox_on_s_chain(
                ethersProviderMainNet,
                joLockAndDataSChain,
                joAccount
            )
        ).to.be.true;
    });

    it('should return `false` invoke `register_main_net_depositBox_on_s_chain`', async function () {
        let joDepositBoxMainNet; // for `false` output
        expect(await IMA.
            register_main_net_depositBox_on_s_chain(
                ethersProviderSChain,
                joDepositBoxMainNet,
                joLockAndDataSChain,
                joAccount,
                -4,
                transactionCustomizerSChain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `register_main_net_depositBox_on_s_chain`', async function () {
        let joDepositBoxMainNet = { "options": { "address": "0xd34e38f830736DB41CC6E10aA37A3C851A7a2B82"}};
        expect(await IMA.
            register_main_net_depositBox_on_s_chain(
                ethersProviderSChain,
                joDepositBoxMainNet,
                joLockAndDataSChain,
                joAccount,
                -4,
                transactionCustomizerSChain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `doEthPaymentFromMainNet`', async function () {
        let joAccountSrc, wei_how_much; // for `false` output
        expect(await IMA.
            doEthPaymentFromMainNet(
                ethersProviderMainNet,
                joAccountSrc,
                joAccountDst,
                joDepositBox,
                chainIdSChain,
                wei_how_much, // how much WEI money to send
                transactionCustomizerMainNet
            )
        ).to.be.false;
    });

    it('should return `true` invoke `doEthPaymentFromMainNet`', async function () {
        let wei_how_much;
        expect(await IMA.
            doEthPaymentFromMainNet(
                ethersProviderMainNet,
                joAccountSrc,
                joAccountDst,
                joDepositBox,
                chainIdSChain,
                wei_how_much, // how much WEI money to send
                transactionCustomizerMainNet
            )
        ).to.be.true;
    });

    it('should return `false` invoke `doEthPaymentFromSChain`', async function () {
        let joAccountSrc, wei_how_much; // for `false` output
        expect(await IMA.
            doEthPaymentFromSChain(
                ethersProviderSChain,
                joAccountSrc,
                joAccountDst,
                joTokenManager,
                joLockAndDataSChain,
                wei_how_much, // how much WEI money to send
                transactionCustomizerSChain
            )
        ).to.be.false;
    });

    it('should return `true` invoke `doEthPaymentFromSChain`', async function () {
        let wei_how_much;
        expect(await IMA.
            doEthPaymentFromSChain(
                ethersProviderSChain,
                joAccountSrc,
                joAccountDst,
                joTokenManager,
                joLockAndDataSChain,
                wei_how_much, // how much WEI money to send
                transactionCustomizerSChain
            )
        ).to.be.true;
    });

    it('should return `false` invoke `receiveEthPaymentFromSchainOnMainNet`', async function () {
        let joMainNetAccount; // for `false` output
        expect(await IMA.
            receiveEthPaymentFromSchainOnMainNet(
                ethersProviderMainNet,
                joMainNetAccount,
                joLockAndDataMainNet,
                transactionCustomizerMainNet
            )
        ).to.be.false;
    });

    it('should return `true` invoke `receiveEthPaymentFromSchainOnMainNet`', async function () {
        expect(await IMA.
            receiveEthPaymentFromSchainOnMainNet(
                ethersProviderMainNet,
                joMainNetAccount,
                joLockAndDataMainNet,
                transactionCustomizerMainNet
            )
        ).to.be.true;
    });

    it('should return `null` invoke `viewEthPaymentFromSchainOnMainNet`', async function () {
        let joMainNetAccount; // for `false` output
        expect(await IMA.
            viewEthPaymentFromSchainOnMainNet(
                ethersProviderMainNet,
                joMainNetAccount,
                joLockAndDataMainNet
            )
        ).to.be.null;
    });

    it('should return `true` invoke `viewEthPaymentFromSchainOnMainNet`', async function () {
        expect(await IMA.
            viewEthPaymentFromSchainOnMainNet(
                ethersProviderMainNet,
                joMainNetAccount,
                joLockAndDataMainNet
            )
        ).to.be.true;
    });

    it('should return `false` invoke `doErc20PaymentFromMainNet`', async function () {
        let nAmountOfToken;
        let strCoinNameErc20MainNet;
        let erc20PrivateTestnetJson_main_net;
        let strCoinNameErc20SChain;
        let erc20PrivateTestnetJson_s_chain;
        expect(await IMA.
            doErc20PaymentFromMainNet(
                ethersProviderMainNet,
                ethersProviderSChain,
                joAccountSrc,
                joAccountDst,
                joDepositBox,
                chainIdSChain,
                nAmountOfToken, // how much ERC20 tokens to send
                joTokenManager, // only s-chain
                strCoinNameErc20MainNet,
                erc20PrivateTestnetJson_main_net,
                strCoinNameErc20SChain,
                erc20PrivateTestnetJson_s_chain,
                transactionCustomizerMainNet
            )
        ).to.be.false;
    });

    it('should return `false` invoke `doErc20PaymentFromSChain`', async function () {
        let nAmountOfToken;
        let strCoinNameErc20MainNet;
        let joErc20_main_net;
        let strCoinNameErc20SChain;
        let joErc20_s_chain;
        expect(await IMA.
            doErc20PaymentFromSChain(
                ethersProviderMainNet,
                ethersProviderSChain,
                joAccountSrc,
                joAccountDst,
                joTokenManager, // only s-chain
                joLockAndDataSChain,
                joDepositBox, // only main net
                nAmountOfToken, // how much ERC20 tokens to send
                strCoinNameErc20MainNet,
                joErc20_main_net,
                strCoinNameErc20SChain,
                joErc20_s_chain,
                transactionCustomizerSChain
            )
        ).to.be.false;
    });

    it('should return `false` invoke `doTransfer`', async function () {
        let joMessageProxySrc; // for `false` output
        let chainNameSrc = "test";
        let chainNameDst = "test";
        let nTransactionsCountInBlock = 4;
        let nTransferSteps = 0;
        let nMaxTransactionsCount = 0;
        let nBlockAwaitDepth = 0;
        let nBlockAge = 0;
        const joRuntimeOpts = {
            isInsideWorker: false,
            idxChainKnownForS2S: 0,
            cntChainsKnownForS2S: 0
        };
        expect(await IMA.
            doTransfer(
                "M2S",
                joRuntimeOpts,
                ethersProviderSrc,
                joMessageProxySrc,
                joAccountSrc,
                ethersProviderDst,
                joMessageProxyDst,
                joAccountDst,
                chainNameSrc,
                chainNameDst,
                -4,
                -4,
                null, // joDepositBox - for logs validation on mainnet
                null, // joTokenManager - for logs validation on s-chain
                nTransactionsCountInBlock,
                nTransferSteps,
                nMaxTransactionsCount,
                nBlockAwaitDepth,
                nBlockAge,
                null,
                transactionCustomizerMainNet, // or transactionCustomizerSChain
                null
            )
        ).to.be.false;
    });

    it('should return `true` invoke `doTransfer`', async function () {
        let chainNameSrc = "test";
        let chainNameDst = "test";
        let nTransactionsCountInBlock = 4;
        let nTransferSteps = 0;
        let nMaxTransactionsCount = 0;
        let nBlockAwaitDepth = 0;
        let nBlockAge = 0;
        const joRuntimeOpts = {
            isInsideWorker: false,
            idxChainKnownForS2S: 0,
            cntChainsKnownForS2S: 0
        };
        expect(await IMA.
            doTransfer(
                "M2S",
                joRuntimeOpts,
                ethersProviderSrc,
                joMessageProxySrc,
                joAccountSrc,
                ethersProviderDst,
                joMessageProxyDst,
                joAccountDst,
                chainNameSrc,
                chainNameDst,
                -4,
                -4,
                null, // joDepositBox - for logs validation on mainnet
                null, // joTokenManager - for logs validation on s-chain
                nTransactionsCountInBlock,
                nTransferSteps,
                nMaxTransactionsCount,
                nBlockAwaitDepth,
                nBlockAge,
                null,
                transactionCustomizerMainNet, // or transactionCustomizerSChain
                null
            )
        ).to.be.true;
    });
});