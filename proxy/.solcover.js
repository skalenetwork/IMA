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
        callGasLimit: 10e6,
        gasLimit: 50e6,
        port: 8555
    }
};
