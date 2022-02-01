import Common from "ethereumjs-common";
const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnSchain() {
    let schainABIs = require("./contracts/schain_ABIs.json");
    let schainERC20ABI = require("./contracts/schain_ERC20_ABI.json");
    let rinkebyERC20ABI = require("./contracts/rinkeby_ERC20_ABI.json");

    let privateKey = Buffer.from(
        "SCHAIN_OWNER_PRIVATE_KEY",
        "hex"
    );
    let erc20OwnerForSchain = process.env.REACT_APP_INSECURE_SCHAIN_OWNER_ACCOUNT;

    let schain = process.env.REACT_APP_INSECURE_SKALE_CHAIN;
    let chainId = process.env.REACT_APP_INSECURE_CHAIN_ID;

    const customCommon = Common.forCustomChain(
        "mainnet", {
            name: "skale-network",
            chainId: chainId
        },
        "istanbul"
    );

    const tokenManagerAddress = schainABIs.token_manager_erc20_address;
    const tokenManagerABI = schainABIs.token_manager_erc20_abi;

    const erc20AddressOnMainnet = rinkebyERC20ABI.erc20_address;
    const erc20AddressOnSchain = schainERC20ABI.erc20_address;

    const web3ForSchain = new Web3(schain);

    let TokenManager = new web3ForSchain.eth.Contract(
        tokenManagerABI,
        tokenManagerAddress
    );

    /**
     * Uses the SKALE TokenManagerERC20
     * contract function addERC20TokenByOwner
     */
    let addERC20TokenByOwner = TokenManager.methods
        .addERC20TokenByOwner(erc20AddressOnMainnet, erc20AddressOnSchain)
        .encodeABI();

    web3ForSchain.eth.getTransactionCount(erc20OwnerForSchain).then((nonce) => {
        const rawTxAddERC20TokenByOwner = {
            from: erc20OwnerForSchain,
            nonce: "0x" + nonce.toString(16),
            data: addERC20TokenByOwner,
            to: tokenManagerAddress,
            gas: 6500000,
            gasPrice: 100000000000,
            value: web3ForSchain.utils.toHex(web3ForSchain.utils.toWei("0", "ether"))
        };

        //sign transaction
        const txAddERC20TokenByOwner = new Tx(rawTxAddERC20TokenByOwner);

        txAddERC20TokenByOwner.sign(privateKey);

        const serializedTxDeposit = txAddERC20TokenByOwner.serialize();

        //send signed transaction (addERC20TokenByOwner)
        web3ForSchain.eth
            .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
            .on("receipt", (receipt) => {
                console.log(receipt);
            })
            .catch(console.error);
    })
};