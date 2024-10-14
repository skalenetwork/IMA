import { promises as fs } from 'fs';
import { contracts as mainnetContracts } from "../migrations/deployMainnet";
import { contracts as schainContracts } from "../migrations/deploySchain";
import { ethers } from "hardhat";
import { getAbi, getVersion } from '@skalenetwork/upgrade-tools';

async function writeAbiToFile(contracts: string[], filename: string) {
    const abi: {[name: string]: []} = {};
    for (const contractName of contracts) {
        console.log(`Load ABI of ${contractName}`);
        const factory = await ethers.getContractFactory(contractName);
        abi[contractName] = getAbi(factory.interface);
    }
    console.log(`Save to ${filename}`)
    await fs.writeFile(filename, JSON.stringify(abi, null, 4));
}

async function main() {
    const version = await getVersion();
    const mainnetFilename = `data/mainnet-ima-${version}-abi.json`;
    const schainFilename = `data/schain-ima-${version}-abi.json`;
    await writeAbiToFile(
        mainnetContracts,
        mainnetFilename
    );
    await writeAbiToFile(
        [
            ...schainContracts,
            "TokenManagerERC721WithMetadata"
        ],
        schainFilename
    );
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
