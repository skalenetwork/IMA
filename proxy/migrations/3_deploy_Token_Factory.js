let fs = require("fs");
require('dotenv').config();

let TokenFactory = artifacts.require("./TokenFactory.sol");
let TokenManager = artifacts.require("./TokenManager.sol");

const networkName = process.env.NETWORK_FOR_SCHAIN;
const privateKey = process.env.ETH_PRIVATE_KEY_FOR_SCHAIN;

let networks = require("../truffle-config.js");
let currentNetwork = networks['networks'][networkName];
let proxySchain = require("../data/proxySchain.json");

const LINE = '======================================';

const Web3 = require('web3');
const PrivateKeyProvider = require("truffle-privatekey-provider");
const provider = new PrivateKeyProvider(privateKey, `http://${currentNetwork['host']}:${currentNetwork['port']}`);
const web3beta = new Web3(provider);

const account = web3beta['_provider']['address'];

async function deployContract(contract, options) {
    let contractName = contract['_json']['contractName'];
    console.log(LINE);
    console.log(`Deploying: ${contractName}, options: ${JSON.stringify(options)}`);
    const contractObj = new web3beta.eth.Contract(contract['_json']['abi']);
    const result = await contractObj.deploy({data: contract['_json']['bytecode'], arguments: options['arguments']})
        .send({gas: options['gas'], from: options['account'], value: options['value']});
    //console.log(result);
    console.log(`${contractName} deployed to: ${result.options.address}`);
    return {receipt: result, contract: contractObj, address: result.options.address};
}

async function deploy(deployer) {
    console.log('Attempting to deploy from account: ', account);

    let tokenFactoryResult = await deployContract(TokenFactory, {gas: 8000000, 'account': account});

    tokenFactoryResult.contract._address = tokenFactoryResult.address;

    let receipt = await tokenFactoryResult.contract.methods.transferOwnership(proxySchain['token_manager_address']).send({
        from: account,
        gas: 200000
    });

    let tokenManager = new web3beta.eth.Contract(proxySchain['token_manager_abi'], proxySchain['token_manager_address']);
    let result = await tokenManager.methods.setTokenFactory(tokenFactoryResult.address).send({
        from: account,
        gas: 200000
    });

    console.log(result);
    
    let jsonObject = {
        token_factory_address: tokenFactoryResult.address,
        token_factory_abi: TokenFactory.abi
    }

    fs.writeFile('data/tokenFactorySchain.json', JSON.stringify(jsonObject), function (err) {
        if (err) {
          return console.log(err);
        }
        console.log('Done, check tokenFactorySchain.json file in data folder.');
        process.exit(0);
      });
}

module.exports = deploy;