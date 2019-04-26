let fs = require("fs");

let MessageProxy = artifacts.require("./MessageProxy.sol");
let DepositBox = artifacts.require("./DepositBox.sol");

async function deploy(deployer) {

    await deployer.deploy(MessageProxy, "Mainnet", {gas: 8000000}).then(async function() {
        return await deployer.deploy(DepositBox, MessageProxy.address, {gas: 8000000});
    });

    let jsonObject = {
        deposit_box_address: DepositBox.address,
        deposit_box_abi: DepositBox.abi,
        message_proxy_mainnet_address: MessageProxy.address,
        message_proxy_mainnet_abi: MessageProxy.abi
    }

    await fs.writeFile('data/proxyMainnet.json', JSON.stringify(jsonObject), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log('Done, check proxyMainnet file in data folder.');
        process.exit(0);
    });
}

module.exports = deploy;