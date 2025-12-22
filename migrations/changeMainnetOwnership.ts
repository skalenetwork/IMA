import {skaleContracts} from "@skalenetwork/skale-contracts-ethers-v6";
import {contracts} from "./deployMainnet";
import {ethers} from "hardhat";
import {EoaSubmitter, InstanceAdmin, InstanceAdminOptions, SafeSubmitter} from "@skalenetwork/upgrade-tools";

async function main() {
    const contractsWithOwnershipToChange = contracts;
    let readonly = false;
    let renounceRoles = true;
    let testMode = false;
    let oldOwner: string;
    let submitter: EoaSubmitter | SafeSubmitter;

    if (!process.env.NEW_OWNER) {
        throw new Error("Please set NEW_OWNER env variable");
    }
    const newOwner: string = process.env.NEW_OWNER;

    if (!process.env.TARGET) {
        throw new Error("Please set TARGET env variable");
    }

    // Set readonly variable if desired
    if (process.env.READONLY) {
        readonly = process.env.READONLY === "true";
    }

    if (process.env.TEST_MODE === "true") {
        readonly = false;
        renounceRoles = true;
        testMode = true;
    }

    if (process.env.REVOKE_ROLES) {
        renounceRoles = process.env.REVOKE_ROLES === "true";
    }


    if (process.env.MULTISIG_OWNER) {
        oldOwner = process.env.MULTISIG_OWNER;
        submitter = new SafeSubmitter(oldOwner);
    } else {
        oldOwner = (await ethers.getSigners())[0].address;
        submitter = new EoaSubmitter();
    }


    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("mainnet-ima");
    const instance = await project.getInstance(process.env.TARGET);
    await instance.getContract("Linker"); // to ensure that the instance is initialized correctly

    const configs: InstanceAdminOptions = {
        newOwner,
        readonly,
        renounceRoles,
        testMode,
        oldOwner,
        submitter,
        rolesToCheck: [
            "CHAIN_CONNECTOR_ROLE",
            "EXTRA_CONTRACT_REGISTRAR_ROLE",
            "CONSTANT_SETTER_ROLE",
            "LINKER_ROLE",
            "DEPOSIT_BOX_MANAGER_ROLE",
            "PAUSABLE_ROLE",
            "ARBITER_ROLE"
        ]
    }
    const admin = new InstanceAdmin(
        contractsWithOwnershipToChange.map(contract => ({name: contract})),
        configs,
        instance
    );
    await admin.executeOwnershipTransfer();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
