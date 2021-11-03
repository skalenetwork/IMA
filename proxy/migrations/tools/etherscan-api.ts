import axios from "axios";


function getEtherscanApiUrl(chainId: number) {
    if (chainId === 1) {
        return "https://api.etherscan.io/";
    } else if (chainId === 3) {
        return "https://api-ropsten.etherscan.io/";
    } else if (chainId === 4) {
        return "https://api-rinkeby.etherscan.io/";
    } else if (chainId === 42) {
        return "https://api-kovan.etherscan.io/";
    } else if (chainId = 420) {
        return "https://api-goerli.etherscan.io/";
    } else {
        return undefined;
    }
}

export async function getTxsFromEtherscan(chainId: number, address: string) {
    const etherscanApiUrl = getEtherscanApiUrl(chainId);
    let txlist;
    if (etherscanApiUrl) {
        try {
            const txlistResponse = await axios.get(`${etherscanApiUrl}api?module=account&action=txlist&address=${address}&apiKey=${process.env.ETHERSCAN}`);
            txlist = txlistResponse.data.result;
        } catch (e: any) {
            console.log(e);
        }
    }
    return txlist;
}