<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE Interchain Messaging Agent (IMA)

[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

## A critical note about production readiness

The IMA is still in active development and therefore should be regarded as _alpha software_. The development is still subject to further security hardening, testing, and breaking changes.

**The proxy contracts have been reviewed and audited by a third-parties for security.**
Please see [SECURITY.md](.github/SECURITY.md) for audit reports and reporting policies.

## Software Architecture

IMA consists of the following three parts:

1)  `Mainnet` smart contracts.
2)  `SKALE Chain` smart contracts.
3)  A containerized Agent application.

Smart contracts are interfaces for any software working with `Mainnet` and `SKALE Chain` like other smart contracts deployed there or software connecting these Ethereum networks.
The Agent is a Node JS application connecting the smart contracts on Mainnet with SKALE Chains.

## Components Structure

### Proxy

IMA proxy is the Solidity part of IMA containing `Mainnet` and `SKALE Chain` smart contracts.

### Agent

IMA Agent is the main application implementing connectivity and message transfer between `Mainnet` and `SKALE Chains`. The Agent also provides an easy way to perform ETH, ERC20, and ERC721 transfers between `Main Net` and `S-Chain` nevertheless, this can be done without it.

### NPMs

The `npms` folder contains helper modules implementing parts of IMA functionality:

#### SKALE-IMA

A module implementing core IMA functionality.

#### SKALE-OWASP

Data validity verifier module. See [OWASP document](https://www.gitbook.com/download/pdf/book/checkmarx/JS-SCP).

#### SKALE-OBSERVER

[SKALE Network Browser](npms/skale-observer/README.md). Responsible for providing description of all SKALE chains.

#### SKALE-LOG

Console and log file output with rotation.

#### SKALE-CC

ANSI colorizer for console and log output.

## For more information

-   [SKALE Network Website](https://skale.network)
-   [SKALE Network Twitter](https://twitter.com/SkaleNetwork)
-   [SKALE Network Blog](https://skale.network/blog)

Learn more about the SKALE community over on [Discord](https://discord.gg/vvUtWJB).

## Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

## License

[![License](https://img.shields.io/github/license/skalenetwork/IMA)](LICENSE)
All contributions are made under the [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.en.html). See [LICENSE](LICENSE).
Copyright (C) 2019-Present SKALE Labs.
[This is a link](src/Test.java)
