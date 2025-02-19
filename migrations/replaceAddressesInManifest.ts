#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { promises as fs } from "fs";
import path from "path";
import { ManifestData } from "@openzeppelin/upgrades-core";

const predeployedAddresses: Record<string, string> = {
  message_proxy_chain: "0xd2AAa00100000000000000000000000000000000",
  message_proxy_chain_implementation: "0xD2AAa001D2000000000000000000000000000000",
  key_storage: "0xd2aaa00200000000000000000000000000000000",
  key_storage_implementation: "0xD2AAa002d2000000000000000000000000000000",
  community_locker: "0xD2aaa00300000000000000000000000000000000",
  community_locker_implementation: "0xD2aaA003d2000000000000000000000000000000",
  token_manager_eth: "0xd2AaA00400000000000000000000000000000000",
  token_manager_eth_implementation: "0xd2AaA004d2000000000000000000000000000000",
  token_manager_erc20: "0xD2aAA00500000000000000000000000000000000",
  token_manager_erc20_implementation: "0xd2aAa005d2000000000000000000000000000000",
  token_manager_erc721: "0xD2aaa00600000000000000000000000000000000",
  token_manager_erc721_implementation: "0xd2AAa006d2000000000000000000000000000000",
  token_manager_erc721_with_metadata: "0xd2AaA00a00000000000000000000000000000000",
  token_manager_erc721_with_metadata_implementation: "0xd2AAA00Ad2000000000000000000000000000000",
  eth_erc20: "0xD2Aaa00700000000000000000000000000000000",
  eth_erc20_implementation: "0xD2aaA007d2000000000000000000000000000000",
  token_manager_linker: "0xD2aAA00800000000000000000000000000000000",
  token_manager_linker_implementation: "0xd2aAA008D2000000000000000000000000000000",
  token_manager_erc1155: "0xD2aaA00900000000000000000000000000000000",
  token_manager_erc1155_implementation: "0xD2AaA009d2000000000000000000000000000000",
};

const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";


async function loadManifest(filePath: string): Promise<ManifestData> {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data) as ManifestData;
}

async function loadAbi(filePath: string): Promise<Record<string, string>> {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data);
}

async function writeManifest(filePath: string, manifestData: ManifestData): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(manifestData, null, 2));
  console.log(`[DONE] Wrote updated manifest to: ${filePath}`);
}

async function getImplementationAddress(proxyAddress: string): Promise<string> {
  const storageValue = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const uncheckedAddress = "0x" + storageValue.slice(-40);
  return ethers.getAddress(uncheckedAddress);
}

function updateManifestProxyAddress(
  manifest: ManifestData,
  predeployedAddr: string,
  actualProxyAddress: string,
): boolean {
  let replaced = false;

  if (Array.isArray(manifest.proxies)) {
    for (const proxy of manifest.proxies) {
      if (proxy.address?.toLowerCase() === predeployedAddr.toLowerCase()) {
        proxy.address = actualProxyAddress;
        replaced = true;
      }
    }
  }

  if (
    manifest.admin &&
    manifest.admin.address &&
    manifest.admin.address.toLowerCase() === predeployedAddr.toLowerCase()
  ) {
    manifest.admin.address = actualProxyAddress;
    replaced = true;
  }

  return replaced;
}

function updateManifestImplementationAddress(
  manifest: ManifestData,
  oldPredeployedImplAddr: string,
  actualImplementationAddress: string,
): boolean {
  let replaced = false;

  if (manifest.impls) {
    for (const implData of Object.values(manifest.impls)) {
      if (implData?.address.toLowerCase() === oldPredeployedImplAddr.toLowerCase()) {
        implData.address = actualImplementationAddress;
        replaced = true;
      }
    }
  }

  return replaced;
}


async function replaceAddressesInManifest(
  manifestPath: string,
  abiPath: string
) {
  const manifest = await loadManifest(manifestPath);
  const abiFile = await loadAbi(abiPath);

  for (const [key, predeployedAddr] of Object.entries(predeployedAddresses)) {
    const isImplementationKey = key.endsWith("_implementation");
    const baseContractName = isImplementationKey
      ? key.replace("_implementation", "")
      : key;

    const abiKey = `${baseContractName}_address`;

    if (!isImplementationKey) {
      const actualProxyAddress = abiFile[abiKey];
      if (!actualProxyAddress) {
        continue;
      }

      const replaced = updateManifestProxyAddress(manifest, predeployedAddr, actualProxyAddress);
      if (replaced) {
        console.log(`[OK] Proxy address for ${baseContractName} replaced with ${actualProxyAddress}`);
      } else {
        console.log(`[INFO] No references replaced for ${baseContractName} (${predeployedAddr}).`);
      }

      const actualImplementationAddress = await getImplementationAddress(actualProxyAddress);

      const oldPredeployedImplKey = `${baseContractName}_implementation`;
      const oldPredeployedImplAddr = predeployedAddresses[oldPredeployedImplKey];
      if (oldPredeployedImplAddr) {
        const implReplaced = updateManifestImplementationAddress(
          manifest,
          oldPredeployedImplAddr,
          actualImplementationAddress,
        );

        if (implReplaced) {
          console.log(
            `[OK] Implementation for ${baseContractName} replaced with ${actualImplementationAddress}`,
          );
        } else {
          console.log(
            `[INFO] No references replaced for implementation of ${baseContractName} (${oldPredeployedImplAddr}).`,
          );
        }
      }
    }
  }

  await writeManifest(manifestPath, manifest);
}

(async () => {
  try {
    if (!process.env.MANIFEST || !process.env.ABI) {
      throw new Error("MANIFEST or ABI environment variables are not set.");
    }

    const manifestPath = path.resolve(process.env.MANIFEST);
    const abiPath = path.resolve(process.env.ABI);

    await replaceAddressesInManifest(manifestPath, abiPath);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
