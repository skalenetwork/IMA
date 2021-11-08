import { promises as fs } from 'fs';
import { exec as asyncExec } from "child_process";
import util from 'util';
const exec = util.promisify(asyncExec);

export async function getMainnetVersion(): Promise<string> {
    if (process.env.MAINNET_VERSION) {
        return process.env.MAINNET_VERSION;
    }
    try {
        const tag = (await exec("git describe --tags")).stdout.trim();
        return tag;
    } catch {
        return (await fs.readFile("../MAINNET_VERSION", "utf-8")).trim();
    }
}

export async function getSchainVersion(): Promise<string> {
    if (process.env.SCHAIN_VERSION) {
        return process.env.SCHAIN_VERSION;
    }
    try {
        const tag = (await exec("git describe --tags")).stdout.trim();
        return tag;
    } catch {
        return (await fs.readFile("../SCHAIN_VERSION", "utf-8")).trim();
    }
}