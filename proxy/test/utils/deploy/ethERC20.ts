import { ethers } from "hardhat";
import { EthERC20 } from "../../../typechain/EthERC20";

export async function deployEthERC20() {
    const factory = await ethers.getContractFactory("EthERC20");
    const instance = await factory.deploy() as EthERC20;
    return instance;
}
