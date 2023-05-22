import { ethers, run, network } from "hardhat";
import chalk from "chalk";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

export async function verify(contractName: string, contractAddress: string, constructorArguments: object) {
    if (![1337, 31337].includes((await ethers.provider.getNetwork()).chainId)) {
        for (let retry = 0; retry <= 5; ++retry) {
            try {
                await run("verify:verify", {
                    address: contractAddress,
                    constructorArguments
                });
                break;
            } catch (e: any) {
                if (e.toString().includes("Contract source code already verified")) {
                    console.log(chalk.grey(`${contractName} is already verified`));
                    return;
                }
                console.log(chalk.red(`Contract ${contractName} was not verified on etherscan`));
                console.log(e.toString());
            }
        }
    }
}

export async function verifyProxy(contractName: string, proxyAddress: string, constructorArguments: object) {
    await verify(contractName, await getImplementationAddress(network.provider, proxyAddress), constructorArguments);
}