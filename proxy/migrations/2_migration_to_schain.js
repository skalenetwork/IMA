let fs = require("fs");
let MessageProxy = artifacts.require("./MessageProxy.sol");
let TokenManager = artifacts.require("./TokenManager.sol");
let TokenFactory = artifacts.require("./TokenFactory.sol");

let networks = require("../truffle-config.js");
let proxyMainnet = require("../data/proxyMainnet.json");

async function deploy(deployer, network) {
    
    console.log(network);
    if (network != "schain") {
        console.log("Please use network with name 'schain'");
        process.exit(0);
    }
    if (networks['networks'][network]['name'] == undefined || networks['networks'][network]['name'] == "") {
        console.log("Please set SCHAIN_NAME to .env file");
        process.exit(0);
    }
    let schainName = networks['networks'][network]['name'];
    await deployer.deploy(MessageProxy, schainName, {gas: 8000000}).then(async function() {
        return await deployer.deploy(TokenManager, schainName, proxyMainnet['deposit_box_address'], MessageProxy.address, {gas: 8000000, value: "10000000000000000000"});
    }).then(async function(inst) {
        await deployer.deploy(TokenFactory).then(function(res) {
            return res.transferOwnership(TokenManager.address);
        });
        return await inst.setTokenFactory(TokenFactory.address).then(async function() {
            let jsonObject = {
                token_manager_address: TokenManager.address,
                token_manager_abi: TokenManager.abi,
                message_proxy_chain_address: MessageProxy.address,
                message_proxy_chain_abi: MessageProxy.abi
            }
        
            await fs.writeFile('data/proxySchain.json', JSON.stringify(jsonObject), function (err) {
                if (err) {
                    return console.log(err);
                }
                console.log('Done, check proxySchain file in data folder.');
                // process.exit(0);
            });
        });
    });

    // let jsonObject = {
    //     token_manager_address: TokenManager.address,
    //     token_manager_abi: TokenManager.abi,
    //     message_proxy_chain_address: MessageProxy.address,
    //     message_proxy_chain_abi: MessageProxy.abi
    // }

    // await fs.writeFile('data/proxySchain.json', JSON.stringify(jsonObject), function (err) {
    //     if (err) {
    //         return console.log(err);
    //     }
    //     console.log('Done, check proxySchain file in data folder.');
    //     process.exit(0);
    // });

    console.log("Deployment done!");
}

module.exports = deploy;