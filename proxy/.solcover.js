module.exports = {    
    compileCommand: 'npx truffle compile --network coverage',
    testCommand: 'npx truffle test --network coverage --gas_multiplier 10',    
    norpc: true,
    skipFiles: [],
    providerOptions: {
        default_balance_ether: 3000, //000000000000000000,
        callGasLimit: 10000000,
        gasLimit: 0xfffffffffff,
        port: 8555
    }
};
