import { ethers, upgrades, run } from "hardhat";
import { ProxyAdmin } from "../typechain";
import * as ProxyAdminArtifacts from "@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json"

async function main() {
    if ((await ethers.provider.getNetwork()).chainId < 10) {
        // Ethereum
        let messageProxyAddress = "0x8629703a9903515818C2FeB45a6f6fA5df8Da404";
        if (process.env.MESSAGE_PROXY !== undefined) {
            messageProxyAddress = process.env.MESSAGE_PROXY;
        }
        const newImplementation = await upgrades.prepareUpgrade(messageProxyAddress, await ethers.getContractFactory("MessageProxyForMainnet"));

        for (let retry = 0; retry <= 5; ++retry) {
            try {
                await run("verify:verify", {
                    address: newImplementation,
                    constructorArguments: []
                });
                break;
            } catch (e) {
                if (e instanceof Error) {
                    if (e.toString().includes("Contract source code already verified")) {
                        console.log(`MessageProxyForMainnet is already verified`);
                        return;
                    }
                    console.log(`Contract MessageProxyForMainnet was not verified on etherscan`);
                    console.log(e.toString());
                } else {
                    console.log("Unknown exception type:", e)
                }
            }
        }

        console.log(`Upgrade proxy at address ${messageProxyAddress}`);
        console.log("with new implementation at");
        console.log(newImplementation);

    } else {
        // SKALE chain

        let messageProxyAddress = "0xd2AAa00100000000000000000000000000000000";
        let proxyAdminAddress = "0xd2aAa00000000000000000000000000000000000"
        if (process.env.MESSAGE_PROXY !== undefined) {
            messageProxyAddress = process.env.MESSAGE_PROXY;
        }
        if (process.env.PROXY_ADMIN !== undefined) {
            proxyAdminAddress = process.env.PROXY_ADMIN;
        }

        console.log("Deploy new implementation");
        const newImplementation = await (
                await ethers.getContractFactory("MessageProxyForSchain")
            ).deploy();
        await newImplementation.deployTransaction.wait();
        console.log(`Deployed on address ${newImplementation.address}`)

        console.log("Upgrade a proxy");
        const proxyAdmin = (new ethers.Contract(proxyAdminAddress, ProxyAdminArtifacts.abi, ethers.provider))
            .connect((await ethers.getSigners())[0]) as ProxyAdmin;
        const upgradeTransaction = await proxyAdmin.upgrade(messageProxyAddress, newImplementation.address);
        const receipt = await upgradeTransaction.wait();
        if (receipt.status === 1) {
            console.log("Successfully upgraded");
        } else {
            console.log("Something went wrong");
        }
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
