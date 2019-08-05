require('dotenv').config();
const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
let mainnetData = require("../data/proxyMainnet.json");
let schainData = require("../data/proxySchain_MySchain.json");
let erc721Data = require("../data/erc721.json");

let mainnetRPC = process.env.MAINNET_RPC_URL;
let schainRPC = process.env.SCHAIN_RPC_URL;
let accountMainnet = process.env.ACCOUNT_FOR_MAINNET;
let accountSchain = process.env.ACCOUNT_FOR_SCHAIN;
let schainName = process.env.SCHAIN_NAME;
let privateKeyForMainnet = process.env.MNEMONIC_FOR_MAINNET;
let privateKeyForSchain = process.env.MNEMONIC_FOR_SCHAIN;

let messageProxyMainnetAddress = mainnetData.message_proxy_mainnet_address;
let messageProxyMainnetABI = mainnetData.message_proxy_mainnet_abi;

let depositBoxAddress = mainnetData.deposit_box_address;
let depositBoxABI = mainnetData.deposit_box_abi;

let lockAndDataForMainnetAddress = mainnetData.lock_and_data_for_mainnet_address;
let lockAndDataForMainnetABI = mainnetData.lock_and_data_for_mainnet_abi;

let lockAndDataForSchainAddress = schainData.lock_and_data_for_schain_address;
let lockAndDataForSchainABI = schainData.lock_and_data_for_schain_abi;

let ethERC20Address = schainData.eth_erc20_address;
let ethERC20ABI = schainData.eth_erc20_abi;

let tokenManagerAddress = schainData.token_manager_address;
let tokenManagerABI = schainData.token_manager_abi;

let erc20ModuleForSchainAddress = schainData.erc20_module_for_schain_address;
let erc20ModuleForSchainABI = schainData.erc20_module_for_schain_abi;

let lockAndDataERC20ForMainnetAddress = mainnetData.lock_and_data_for_mainnet_erc20_address;
let lockAndDataERC20ForMainnetABI = mainnetData.lock_and_data_for_mainnet_erc20_abi;

let lockAndDataERC20ForSchainAddress = schainData.lock_and_data_for_schain_erc20_address;
let lockAndDataERC20ForSchainABI = schainData.lock_and_data_for_schain_erc20_abi;

let erc721TokenAddress = erc721Data.erc721_address;
let erc721TokenABI = erc721Data.erc721_abi;

let web3Mainnet = new Web3(new Web3.providers.HttpProvider(mainnetRPC));
let web3Schain = new Web3(new Web3.providers.HttpProvider(schainRPC));

let privateKeyMainnetBuffer = new Buffer(privateKeyForMainnet, 'hex');
let privateKeySchainBuffer = new Buffer(privateKeyForSchain, 'hex');

let DepositBox = new web3Mainnet.eth.Contract(depositBoxABI, depositBoxAddress);
let LockAndDataForMainnet = new web3Mainnet.eth.Contract(lockAndDataForMainnetABI, lockAndDataForMainnetAddress);
let MessageProxyMainnet = new web3Mainnet.eth.Contract(messageProxyMainnetABI, messageProxyMainnetAddress);
let LockAndDataForSchain = new web3Schain.eth.Contract(lockAndDataForSchainABI, lockAndDataForSchainAddress);
let EthERC20 = new web3Schain.eth.Contract(ethERC20ABI, ethERC20Address);
let TokenManager = new web3Schain.eth.Contract(tokenManagerABI, tokenManagerAddress);
let ERC20ModuleForSchain = new web3Schain.eth.Contract(erc20ModuleForSchainABI, erc20ModuleForSchainAddress);
let LockAndDataForMainnetERC20 = new web3Mainnet.eth.Contract(lockAndDataERC20ForMainnetABI, lockAndDataERC20ForMainnetAddress);
let LockAndDataForSchainERC20 = new web3Schain.eth.Contract(lockAndDataERC20ForSchainABI, lockAndDataERC20ForSchainAddress);

let erc20Address = "0x3a5bdd7447D4948a88B09456A161C5c06555381e"; 

let erc20AddressOnSchain = "0xbe693468734455c80c6bc0db66e20da49cc626c8";

let erc721AddressOnSchain ="0xc3f5ab555587741a7ff089e6c60d4eb7297e298c";

let TokenABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0x06fdde03"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0x095ea7b3"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0x18160ddd"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "from",
          "type": "address"
        },
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0x23b872dd"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "name": "",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0x313ce567"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "cap",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0x355274ea"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "addedValue",
          "type": "uint256"
        }
      ],
      "name": "increaseAllowance",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0x39509351"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "mint",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0x40c10f19"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0x70a08231"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0x95d89b41"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "account",
          "type": "address"
        }
      ],
      "name": "addMinter",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0x983b2d56"
    },
    {
      "constant": false,
      "inputs": [],
      "name": "renounceMinter",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0x98650275"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "subtractedValue",
          "type": "uint256"
        }
      ],
      "name": "decreaseAllowance",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0xa457c2d7"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function",
      "signature": "0xa9059cbb"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "account",
          "type": "address"
        }
      ],
      "name": "isMinter",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0xaa271e1a"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "owner",
          "type": "address"
        },
        {
          "name": "spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function",
      "signature": "0xdd62ed3e"
    },
    {
      "inputs": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "decimals",
          "type": "uint8"
        },
        {
          "name": "cap",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "constructor",
      "signature": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "account",
          "type": "address"
        }
      ],
      "name": "MinterAdded",
      "type": "event",
      "signature": "0x6ae172837ea30b801fbfcdd4108aa1d5bf8ff775444fd70256b44e6bf3dfc3f6"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "account",
          "type": "address"
        }
      ],
      "name": "MinterRemoved",
      "type": "event",
      "signature": "0xe94479a9f7e1952cc78f2d6baab678adc1b772d936c6583def489e524cb66692"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event",
      "signature": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "spender",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event",
      "signature": "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
    }
  ];

let erc20Contract = new web3Mainnet.eth.Contract(TokenABI, erc20Address);
let erc20ContractOnSchain = new web3Schain.eth.Contract(TokenABI, erc20AddressOnSchain);

let erc721Contract = new web3Mainnet.eth.Contract(erc721TokenABI, erc721TokenAddress);
let erc721ContractOnSchain = new web3Schain.eth.Contract(erc721TokenABI, erc721AddressOnSchain);

let deposit = DepositBox.methods.deposit(schainName, accountMainnet).encodeABI();

let exitToMain = TokenManager.methods.exitToMain(accountMainnet, "1000000000000000000").encodeABI();

let getMyEth = LockAndDataForMainnet.methods.getMyEth().encodeABI();

let approve = erc20Contract.methods.approve(depositBoxAddress, "10000000000000000000").encodeABI();

let depositERC20 = DepositBox.methods.depositERC20(schainName, erc20Address, accountMainnet, "10000000000000000000").encodeABI();

let addEthCosts = TokenManager.methods.addEthCost("1000000000000000000").encodeABI();

let approveOnSchain = erc20ContractOnSchain.methods.approve(tokenManagerAddress, "10000000000000000000").encodeABI();

let exitToMainERC20 = TokenManager.methods.exitToMainERC20(erc20AddressOnSchain, accountMainnet, "10000000000000000000").encodeABI();

let mintERC721 = erc721Contract.methods.mint(accountMainnet, 1).encodeABI();

let transferERC721 = erc721Contract.methods.transferFrom(accountMainnet, depositBoxAddress, 1).encodeABI();

let transferERC721OnSchain = erc721ContractOnSchain.methods.transferFrom(accountMainnet, tokenManagerAddress, 1).encodeABI();

let depositERC721 = DepositBox.methods.depositERC721(schainName, erc721TokenAddress, accountSchain, 1).encodeABI();

let exitToMainERC721 = TokenManager.methods.exitToMainERC721(erc721AddressOnSchain, accountMainnet, 1).encodeABI();

async function sendTransaction(web3Inst, account, privateKey, data, receiverContract, amount) {
    await web3Inst.eth.getTransactionCount(account).then(nonce => {
        const rawTx = {
            from: account,
            nonce: "0x" + nonce.toString(16),
            data: data,
            to: receiverContract,
            gasPrice: 0,
            gas: 8000000,
            value: web3Inst.utils.toHex(amount)
        };

        const tx = new Tx(rawTx);
        tx.sign(privateKey);
    
        const serializedTx = tx.serialize();

        web3Inst.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', receipt => {
            console.log(receipt);
        });
    });

    console.log("Transaction done!");
}

async function sendMoneyToSchain() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, deposit, depositBoxAddress, "1000000000000000000");
}

async function sendMoneyToMainnet() {
    await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, exitToMain, tokenManagerAddress, 0);
}

async function getMyETH() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, getMyEth, lockAndDataForMainnetAddress, 0);
}

async function sendERC20ToSchain() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, approve, erc20Address, 0);
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, depositERC20, depositBoxAddress, "1000000000000000000");
    
    let balanceLockAndDataOnMainnet = await erc20Contract.methods.balanceOf(lockAndDataERC20ForMainnetAddress).call();
    console.log("Balance ERC20 Token Lock And Data ERC20 On Mainnet", balanceLockAndDataOnMainnet);

    let balanceLockAndDataOnSchain = await erc20ContractOnSchain.methods.balanceOf(lockAndDataERC20ForSchainAddress).call();
    console.log("Balance ERC20 Token Lock And Data ERC20 On Schain", balanceLockAndDataOnSchain);
}

async function sendERC20ToMainnet() {
    await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, addEthCosts, tokenManagerAddress, 0)
    await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, approveOnSchain, erc20AddressOnSchain, 0);
    await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, exitToMainERC20, tokenManagerAddress, 0);

    let balanceLockAndDataOnMainnet = await erc20Contract.methods.balanceOf(lockAndDataERC20ForMainnetAddress).call();
    console.log("Balance ERC20 Token Lock And Data ERC20 On Mainnet", balanceLockAndDataOnMainnet);

    let balanceLockAndDataOnSchain = await erc20ContractOnSchain.methods.balanceOf(lockAndDataERC20ForSchainAddress).call();
    console.log("Balance ERC20 Token Lock And Data ERC20 On Schain", balanceLockAndDataOnSchain);
}

async function sendERC721ToSchain() {
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, mintERC721, erc721TokenAddress, 0);
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, transferERC721, erc721TokenAddress, 0);
    await sendTransaction(web3Mainnet, accountMainnet, privateKeyMainnetBuffer, depositERC721, depositBoxAddress, "1000000000000000000");
}

async function sendERC721ToMainnet() {
  await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, addEthCosts, tokenManagerAddress, 0);
  await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, transferERC721OnSchain, erc721AddressOnSchain, 0);
  await sendTransaction(web3Schain, accountMainnet, privateKeyMainnetBuffer, exitToMainERC721, tokenManagerAddress, 0);
}



// sendMoneyToMainnet();
// sendMoneyToSchain();
// getMyETH();
// sendERC20ToSchain();
// sendERC20ToMainnet();
// sendERC721ToSchain();
sendERC721ToMainnet();