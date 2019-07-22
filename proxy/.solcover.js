module.exports = {    
    compileCommand: 'npx truffle compile --network coverage',
    testCommand: 'npx truffle test --network coverage --gas_multiplier 10',    
    norpc: true,
    skipFiles: []
};
