const Web3 = require("web3");
const Tx = require("ethereumjs-tx").Transaction;

export function registerOnMainnet() {
    let rinkebyABIs = require("./contracts/rinkeby_ABIs.json");
    let rinkebyERC20ABI = require("./contracts/rinkeby_ERC20_ABI.json");

    let privateKey = Buffer.from(
        "SCHAIN_OWNER_PRIVATE_KEY",
        "hex"
    );
    let erc20OwnerForMainnet =
        process.env.REACT_APP_INSECURE_SCHAIN_OWNER_ACCOUNT;

    let rinkeby = process.env.REACT_APP_INSECURE_RINKEBY;
    let schainName = process.env.REACT_APP_INSECURE_CHAIN_NAME;
    let chainId = process.env.REACT_APP_INSECURE_RINKEBY_CHAIN_ID;

    const depositBoxAddress = rinkebyABIs.deposit_box_erc20_address;
    const depositBoxABI = rinkebyABIs.deposit_box_erc20_abi;

    const erc20AddressOnMainnet = rinkebyERC20ABI.erc20_address;

    const web3ForMainnet = new Web3(rinkeby);

    let DepositBox = new web3ForMainnet.eth.Contract(
        depositBoxABI,
        depositBoxAddress
    );

    /**
     * Uses the SKALE DepositBoxERC20
     * contract function addERC20TokenByOwner
     */
    let addERC20TokenByOwner = DepositBox.methods
        .addERC20TokenByOwner(schainName, erc20AddressOnMainnet)
        .encodeABI();

    web3ForMainnet.eth.getTransactionCount(erc20OwnerForMainnet).then((nonce) => {
        const rawTxAddERC20TokenByOwner = {
            chainId: chainId,
            from: erc20OwnerForMainnet,
            nonce: "0x" + nonce.toString(16),
            data: addERC20TokenByOwner,
            to: depositBoxAddress,
            gas: 6500000,
            gasPrice: 100000000000,
            value: web3ForMainnet.utils.toHex(
                web3ForMainnet.utils.toWei("0", "ether")
            )
        };

        //sign transaction
        const txAddERC20TokenByOwner = new Tx(rawTxAddERC20TokenByOwner, {
            chain: "rinkeby",
            hardfork: "petersburg"
        });

        txAddERC20TokenByOwner.sign(privateKey);

        const serializedTxDeposit = txAddERC20TokenByOwner.serialize();

        //send signed transaction (addERC20TokenByOwner)
        web3ForMainnet.eth
            .sendSignedTransaction("0x" + serializedTxDeposit.toString("hex"))
            .on("receipt", (receipt) => {
                console.log(receipt);
            })
            .catch(console.error);
    })
};