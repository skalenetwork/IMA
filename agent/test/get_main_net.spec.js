const constants = require("../abi_main_net.json");
const assert = require('chai').assert;
const expect = require('chai').expect;
const MTA = require( "../../npms/skale-mta" );
const w3 = require("web3")

describe('tests for `npms/skale-mta`', function () {

    it('should get abi for mainnet', async function () {
        expect(constants.deposit_box_address).to.equal("0x88a5eDcf315599Ade5b6b4cC0991A23Bf9E88f65")
    });

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
        let w3und; // undefined
        // if w3 `undefined` or `null`
        expect(MTA.private_key_2_public_key(w3und, keyPrivate)).to.be.empty;
        // if keyPrivate `undefined` or `null`
        expect(MTA.private_key_2_public_key(w3, keyPrivateUnd)).to.be.empty;
        // when all parameters is OK
        expect(MTA.private_key_2_public_key(w3, keyPrivate)).to.have.lengthOf(128);
    });

    it('should invoke `public_key_2_account_address`', async function () {
        let keyPublic = "5dd431d36ce6b88f27d351051b31a26848c4a886f0dd0bc87a7d5a9d821417c9" +
            "e807e8589f680ab0f2ab29831231ad7b3d6659990ee830582fede785fc3c33c4";
        let keyPublicUnd; // undefined
        let w3und; // undefined
        // if w3 `undefined` or `null`
        expect(MTA.public_key_2_account_address(w3und, keyPublic)).to.be.empty;
        // if keyPrivate `undefined` or `null`
        expect(MTA.public_key_2_account_address(w3, keyPublicUnd)).to.be.empty;
        // when all parameters is OK
        expect(MTA.public_key_2_account_address(w3, keyPublic)).to.include("0x");
    });

    it('should invoke `public_key_2_account_address`', async function () {
        let keyPrivate = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
        let keyPrivateUnd; // undefined
        let w3und; // undefined
        // if w3 `undefined` or `null`
        expect(MTA.public_key_2_account_address(w3und, keyPrivate)).to.be.empty;
        // if keyPrivate `undefined` or `null`
        expect(MTA.public_key_2_account_address(w3, keyPrivateUnd)).to.be.empty;
        // when all parameters is OK
        expect(MTA.public_key_2_account_address(w3, keyPrivate)).to.include("0x");
    });
});