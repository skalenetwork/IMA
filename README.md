<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE IMA (Interchain Messaging Agent)

<div align="center">

[![License](https://img.shields.io/github/license/skalenetwork/IMA.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/skale)
[![Build Status](https://github.com/skalenetwork/IMA/actions/workflows/test.yml/badge.svg)](https://github.com/skalenetwork/IMA/actions)
[![codecov](https://codecov.io/gh/skalenetwork/IMA/branch/develop/graph/badge.svg)](https://codecov.io/gh/skalenetwork/IMA)

<p>Smart contracts enabling secure cross-chain asset transfers and messaging within SKALE Network echosystem</p>

</div>


## Introduction

SKALE IMA (Interchain Messaging Agent) is the bridge infrastructure that enables secure, trustless communication between Ethereum Mainnet and SKALE Chains. It provides the smart contract layer for the SKALE Network's interchain messaging system, allowing users to transfer ETH, ERC-20, ERC-721, and ERC-1155 tokens between chains in the SKALE Network.

The system consists of paired smart contracts deployed on both Mainnet and SKALE Chains. Messages are relayed using the [IMA Agent](https://github.com/skalenetwork/ima-agent) service created by SKALE. Messages are cryptographically signed and verified using BLS threshold signatures by SKALE Chain validator nodes, ensuring decentralized security for all cross-chain operations.

**Core Capabilities:**

- **ETH Bridging:** Deposit and withdraw native ETH between Mainnet and SKALE Chains via `DepositBoxEth` and wrapped ETH (EthERC20) on SKALE.
- **ERC-20 Token Transfers:** Bridge fungible tokens using `DepositBoxERC20` on Mainnet and `TokenManagerERC20` on SKALE Chains.
- **ERC-721 / ERC-721 with Metadata:** Transfer NFTs with optional metadata preservation via dedicated deposit boxes and token managers.
- **ERC-1155 Multi-Token Support:** Bridge semi-fungible tokens using `DepositBoxERC1155` and `TokenManagerERC1155`.
- **Generic Message Proxy:** Send arbitrary cross-chain messages via `MessageProxyForMainnet` and `MessageProxyForSchain` for custom dApp integrations.
- **Community Pool & Locker:** Manage gas reimbursement and community-controlled asset locking for SKALE Chain operations.

For a detailed overview of the repository structure and organization, see [ARCHITECTURE.md](./ARCHITECTURE.md).


## Installation & Setup

### Prerequisites

- Node.js v18 (V20+ might work but currently are not actively tested by CI)
- Python 3.8+ (for static analysis and predeployed scripts)

### Clone and Install

```bash
git clone --recurse-submodules https://github.com/skalenetwork/IMA.git
cd IMA
yarn install
pip3 install -r scripts/requirements.txt # installs slither
```

The `postinstall` script automatically compiles all contracts.


## Running Tests

Tests run on a local Hardhat network and do not require additional setup beyond installation.

**All tests**

```bash
yarn test
```

**Single test / suite**

```bash
yarn test test/DepositBoxERC20.ts
```

**Coverage**

```bash
npx hardhat coverage --solcoverjs .solcover.js
```
### Testing Deployment

```bash
bash ./scripts/test_deploy.sh
```

This command will create a ganache instance and deploy all contracts to it. Starts by deploying and setting up the required components from skale-manager project. It follows with the deployment of the IMA contracts. There's no need for the .env file used in the next section as the scripts handles the entire workflow.

## Deployment

### Environment Configuration

Create a `.env` file with the following variables:

```dotenv
# for mainnet-ima deployment
URL_W3_ETHEREUM="your Mainnet RPC URL (e.g., Infura endpoint)"
PRIVATE_KEY_FOR_ETHEREUM="deployer private key for Mainnet"
SKALE_MANAGER_ADDRESS="SkaleManager address or instance alias"
GASPRICE="(optional) gas price in wei for ETHEREUM mainnet"
ETHERSCAN="(optional) Etherscan API key for verification"

# for schain-ima deployment
URL_W3_S_CHAIN="your SKALE Chain RPC URL"
CHAIN_NAME_SCHAIN="your SKALE Chain name"
PRIVATE_KEY_FOR_SCHAIN="deployer private key for SKALE Chain"
```

### Deploy Commands

**Deploy to Ethereum Mainnet only:**

```bash
yarn deploy-to-mainnet
```

**Deploy to SKALE Chain only:**

```bash
yarn deploy-to-schain
```

**Deploy to both chains in 1 command:**

```bash
yarn deploy-to-both-chains
```

Deployment artifacts are saved to the `data/` directory as `proxyMainnet.json` and `proxySchain_${CHAIN_NAME_SCHAIN}.json`.

### Official deployments - Ethereum Mainnet
* Blockscout: [message-proxy-for-mainnet](https://eth.blockscout.com/address/0x8629703a9903515818C2FeB45a6f6fA5df8Da404)
* Etherscan: [message-proxy-for-mainnet](https://etherscan.io/address/0x8629703a9903515818C2FeB45a6f6fA5df8Da404)

**NOTE:** Just like in skale-manager, other contracts related to mainnet-ima can be found from the ContractManager contract, by using the `getContract` function.


## Security and Audits

**Static Analysis**

This project uses [slither](https://github.com/crytic/slither) as main tool for static analysis.

The following commands can be used to run static analysis:

```bash
# Solidity linting
yarn lint

# TypeScript linting
yarn eslint

# Slither analysis
yarn slither

# Full check (all analysers)
yarn fullCheck
```

### Third-party Audits

| Company        | Audit Report URL                                                                 | Scope/Date            |
| :------------- | :------------------------------------------------------------------------------- | :-------------------- |
| Quantstamp     | [Report](https://certificate.quantstamp.com/full/skale-proxy-contracts.pdf)         | Proxy Contracts, Feb 2021 |
| Bramah Systems | [Report](./audits/SKALE_Audit_Bramah.pdf)                                        | IMA Contracts, Jun 2021   |
| Code4rena      | [Report](https://code4rena.com/reports/2022-02-skale)                            | IMA v1, Feb 2022          |
| Solidified     | [Report](https://github.com/solidified-platform/audits/blob/master/Audit%20Report%20-%20SKALE.pdf) | IMA Contracts, Nov 2022 |

### Bug Bounty Programs

Please see [HackerOne](https://hackerone.com/skale_network?type=team) for SKALE's active bug bounty program **or** submit a bug directly via [encrypted email](mailto:security@skalelabs.com).


## Main Branches

- **develop** – Active development branch with the latest features and ongoing work. This is where contributions should be opened.
- **stable** – Latest stable release, suitable for production deployments.


## Resources

- **SKALE Developer Documentation** – https://docs.skale.space/
- **IMA Agent Repository** – https://github.com/skalenetwork/ima-agent
- **SKALE Whitepaper** – Whitepaper of SKALE Network: https://skale.space/whitepaper
- **SKALE Main Website** – High-level overview of the network, architecture, and ecosystem: https://www.skale.space/
- **SKALE Ecosystem Portal** – Explorer, bridges, staking dashboard, live chains & projects: https://portal.skale.space/


## License

[![License](https://img.shields.io/github/license/skalenetwork/IMA)](LICENSE)

All contributions are made under the [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.en.html). See [LICENSE](LICENSE).

Copyright (C) 2019-Present SKALE Labs.
