const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

let targetABIs = "IMA_ABI_ON_TARGET";
let originERC20ABI = "ERC20_ABI_ON_ORIGIN";

let privateKey = Buffer.from("END_USER_PRIVATE_KEY", 'hex')
let address = "ADDRESS";

let target = "TARGET_ENDPOINT";
let originChainName = "ORIGIN_CHAIN_NAME";
let targetChainId = "TARGET_CHAIN_ID";

const tokenManagerAddress = targetABIs.token_manager_erc20_address;
const tokenManagerABI = targetABIs.token_manager_erc20_abi;

const erc20ABI = targetERC20ABI.erc20_abi;
const erc20TargetAddress = targetERC20ABI.erc20_address;
const erc20OriginAddress = originERC20ABI.erc20_address;

const web3ForTarget = new Web3(target);

let tokenManager = new web3ForTarget.eth.Contract(
    tokenManagerABI,
    tokenManagerAddress
);

const customCommon = Common.forCustomChain(
    "mainnet", {
        name: "skale-network",
        chainId: targetChainId
    },
    "istanbul"
);

let contractERC20 = new web3ForTarget.eth.Contract(erc20ABI, erc20TargetAddress);

let approve = contractERC20.methods
    .approve(
        tokenManagerAddress,
        web3ForTarget.utils.toHex(web3ForTarget.utils.toWei("1", "ether"))
    )
    .encodeABI();

let transfer = tokenManager.methods
    .transferToSchainERC20(
        originChainName,
        erc20OriginAddress,
        web3ForTarget.utils.toHex(web3ForTarget.utils.toWei("1", "ether"))
    )
    .encodeABI();

    web3ForTarget.eth.getTransactionCount(address).then(nonce => {
    //create raw transaction
    const rawTxApprove = {
        chainId: targetChainId,
        from: address,
        nonce: "0x" + nonce.toString(16),
        data: approve,
        to: erc20Address,
        gas: 6500000,
        gasPrice: 100000000000
    };

    //sign transaction
    const txApprove = new Tx(rawTxApprove, {
        common: customCommon
    });
    txApprove.sign(privateKey);

    const serializedTxApprove = txApprove.serialize();

    //send signed transaction (approve)
    web3ForTarget.eth
        .sendSignedTransaction("0x" + serializedTxApprove.toString("hex"))
        .on("receipt", receipt => {
            console.log(receipt);
            web3ForTarget.eth
                .getTransactionCount(address)
                .then(nonce => {
                    const rawTxDeposit = {
                        chainId: targetChainId,
                        from: address,
                        nonce: "0x" + nonce.toString(16),
                        data: transfer,
                        to: tokenManagerAddress,
                        gas: 6500000,
                        gasPrice: 100000000000
                    };

                    //sign transaction
                    const txDeposit = new Tx(rawTxDeposit, {
                        common: customCommon
                    });

                    txDeposit.sign(privateKey);

                    const serializedTxDeposit = txDeposit.serialize();

                    //send signed transaction (deposit)
                    web3ForTarget.eth
                        .sendSignedTransaction("0x" + serializedTxDeposit
                            .toString("hex"))
                        .on("receipt", receipt => {
                            console.log(receipt);
                        })
                        .catch(console.error);
                });
        })
        .catch(console.error);
});