const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

let originABIs = "IMA_ABI_ON_ORIGIN";
let originERC20ABI = "ERC20_ABI_ON_ORIGIN";

let privateKey = Buffer.from("END_USER_PRIVATE_KEY", 'hex')
let address = "ADDRESS";

let origin = "ORIGIN_ENDPOINT";
let targetChainName = "TARGET_CHAIN_NAME";
let originChainId = "ORIGIN_CHAIN_ID";

const tokenManagerAddress = originABIs.token_manager_erc20_address;
const tokenManagerABI = originABIs.token_manager_erc20_abi;

const erc20ABI = originERC20ABI.erc20_abi;
const erc20Address = originERC20ABI.erc20_address;

const web3ForOrigin = new Web3(origin);

let tokenManager = new web3ForOrigin.eth.Contract(
    tokenManagerABI,
    tokenManagerAddress
);

const customCommon = Common.forCustomChain(
    "mainnet", {
        name: "skale-network",
        chainId: originChainId
    },
    "istanbul"
);

let contractERC20 = new web3ForOrigin.eth.Contract(erc20ABI, erc20Address);

let approve = contractERC20.methods
    .approve(
        tokenManagerAddress,
        web3ForOrigin.utils.toHex(web3ForOrigin.utils.toWei("1", "ether"))
    )
    .encodeABI();

let transfer = tokenManager.methods
    .transferToSchainERC20(
        targetChainName,
        erc20Address,
        web3ForOrigin.utils.toHex(web3ForOrigin.utils.toWei("1", "ether"))
    )
    .encodeABI();

web3ForOrigin.eth.getTransactionCount(address).then(nonce => {
    //create raw transaction
    const rawTxApprove = {
        chainId: originChainId,
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
    web3ForOrigin.eth
        .sendSignedTransaction("0x" + serializedTxApprove.toString("hex"))
        .on("receipt", receipt => {
            console.log(receipt);
            web3ForOrigin.eth
                .getTransactionCount(address)
                .then(nonce => {
                    const rawTxDeposit = {
                        chainId: originChainId,
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
                    web3ForOrigin.eth
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