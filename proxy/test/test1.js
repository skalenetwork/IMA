require('dotenv').config();
const networkName = process.env.NETWORK_FOR_MAINNET;
const privateKey =  process.env.ETH_PRIVATE_KEY_FOR_MAINNET;

let networks = require("../truffle-config.js");
let currentNetwork = networks['networks'][networkName];

const LINE = '======================================';

const Web3 = require('web3');
const PrivateKeyProvider = require("truffle-privatekey-provider");
const provider = new PrivateKeyProvider(privateKey, `http://${currentNetwork['host']}:${currentNetwork['port']}`);
const web3 = new Web3(provider);
const web3beta = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
//
const account = web3['_provider']['address'];
////
//
////const Web3 = require('web3');
////const web3 = new Web3(new Web3.providers.HttpProvider("http://51.0.1.99:8545"));
////const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
//
const jsonDataMainnet = require("../data/proxyMainnet.json");
const jsonDataSchain = require("../data/proxySchain.json");
const MessageProxy = new web3.eth.Contract(jsonDataMainnet['message_proxy_mainnet_abi'], jsonDataMainnet['message_proxy_mainnet_address']);
const MessageProxyChain = new web3.eth.Contract(jsonDataSchain['message_proxy_chain_abi'], jsonDataSchain['message_proxy_chain_address']);

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

const TokenAddress = "0xdB9F899B313d22e9C13e499c86c1d73dae2A7cf3";
//const TokenOnSchainAddress = "0x3fe75c61b338c5cf6e9e086288acba44f55929ee";

const DepositBox = new web3.eth.Contract(jsonDataMainnet['deposit_box_abi'], jsonDataMainnet['deposit_box_address']);
const TokenManager = new web3.eth.Contract(jsonDataSchain['token_manager_abi'], jsonDataSchain['token_manager_address']);

const TokenOnMainnet = new web3.eth.Contract(TokenABI, TokenAddress);

//let account = "0x6d806d42a3233336c108cece6bfa277f9a25c1d9";

async function connectChain(ChainID) {
    let res = await MessageProxy.methods.addConnectedChain(ChainID, [1, 1, 1, 1]).send({from: account, gas: 1000000});
    console.log("first", res);
    let res01 = await DepositBox.methods.addSchain(ChainID, jsonDataSchain['token_manager_address']).send({from: account, gas: 1000000});
    console.log("second", res01);
    let res0 = await TokenOnMainnet.methods.approve(jsonDataMainnet['deposit_box_address'], web3.utils.toBN('1000000000000000000').toString()).send({from: account, gas: 1000000});
    console.log("third", res0);
    let res1 = await DepositBox.methods.depositERC20(ChainID, TokenAddress, account, web3.utils.toBN('1000000000000000000').toString()).send({from: account, gas: 1000000, value: web3.utils.toBN("100000000000000")});
    console.log("forth", res1);
    let lastMessage = await MessageProxy.methods.getOutgoingMessagesCounter(ChainID).call({from: account});
    console.log(lastMessage);
    let eventOutgoingMessage = await MessageProxy.getPastEvents("OutgoingMessage", {
        "filter": {"msgCounter": [0]},
        "fromBlock": 0,
        "toBlock": "latest"
    });
    console.log(eventOutgoingMessage);
    let result = eventOutgoingMessage[0].returnValues;
    console.log("Result of Event", result);

    let eventOutgoingMessageTransfer = await MessageProxy.getPastEvents("OutgoingMessage", {
        "filter": {"msgCounter": [1]},
        "fromBlock": 0,
        "toBlock": "latest"
    });
    console.log(eventOutgoingMessageTransfer);
    let resultTransfer = eventOutgoingMessageTransfer[0].returnValues;
    console.log("Result of Event", resultTransfer);

    // let data = TokenOnSchain.methods.transfer(account, web3.utils.toBN('1000000000000000000').toString());
    // let dataToDeposit = data.encodeABI();
    // console.log(dataToDeposit);
    // console.log(dataToDeposit.length / 2 - 1);
    
    let res4 = await MessageProxyChain.methods.postIncomingMessages(
        "Mainnet", 
        0, 
        [result.srcContract], 
        [result.dstContract], 
        [result.to], 
        [result.amount], 
        result.data, 
        [result.length]
    ).send({from: account, gas: 8000000});
    console.log(res4);

    let eventERC20ContractCreated = await TokenManager.getPastEvents("ERC20TokenCreated", {
        "filter": {"contractThere": [TokenAddress]},
        "fromBlock": 0,
        "toBlock": "latest"
    });
    console.log(eventERC20ContractCreated);
    let resultContract = eventERC20ContractCreated[0].returnValues;
    console.log("Result of Event", resultContract);

    let res5 = await MessageProxyChain.methods.postIncomingMessages(
        "Mainnet", 
        1, 
        [resultTransfer.srcContract], 
        [resultTransfer.dstContract], 
        [resultTransfer.to], 
        [resultTransfer.amount], 
        resultTransfer.data, 
        [resultTransfer.length]
    ).send({from: account, gas: 8000000});
    console.log(res5);

    
}

connectChain("New Schain");
