module.exports = {    
    compileCommand: 'npx truffle compile --network coverage',
    testCommand: 'npx buidler test',    
    norpc: true,
    skipFiles: [
        "Migrations.sol",
        "test/"
    ],
    providerOptions: {
        default_balance_ether: 3000, //000000000000000000,
        callGasLimit: 10000000,
        gasLimit: 0xfffffffffff,
        port: 8555
    }
};
