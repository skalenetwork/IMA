const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

let originABIs = "IMA_ABI_ON_ORIGIN";
let originERC1155ABI = "ERC1155_ABI_ON_ORIGIN";

let privateKey = Buffer.from("END_USER_PRIVATE_KEY", 'hex')
let address = "ADDRESS";

let origin = "ORIGIN_ENDPOINT";
let targetChainName = "TARGET_CHAIN_NAME";
let originChainId = "ORIGIN_CHAIN_ID";

const tokenManagerAddress = originABIs.token_manager_erc1155_address;
const tokenManagerABI = originABIs.token_manager_erc1155_abi;

const erc1155ABI = originERC1155ABI.erc1155_abi;
const erc1155Address = originERC1155ABI.erc1155_address;
const tokenId = "TOKEN_ID";

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

let contractERC1155 = new web3ForOrigin.eth.Contract(erc1155ABI, erc1155Address);

let approve = contractERC1155.methods
    .approve(
        tokenManagerAddress,
        tokenId,
        web3ForOrigin.utils.toHex(web3ForOrigin.utils.toWei("1", "ether"))
    )
    .encodeABI();

let transfer = tokenManager.methods
    .transferToSchainERC1155(
        targetChainName,
        erc1155Address,
        tokenId,
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
        to: erc1155Address,
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