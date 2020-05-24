<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE Interchain Messaging Agent (IMA)

[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

## An important note about production readiness

The IMA is still in active development and therefore should be regarded as _alpha software_. The development is still subject to security hardening, further testing, and breaking changes.
**This software has not yet  been reviewed or audited for security.**
Please see [SECURITY.md](SECURITY.md) for reporting policies.

## Software Architecture

IMA consists of the following three parts:

1) `Main Net` smart contracts.
2) `S-Chain` smart contract.
3) Agent application.

Smart contracts are interfaces for any software working with `Main Net` and `S-Chain` like other smart contracts deployed there or software connecting these Ethereum networks.
Agent is Node JS application connecting first two parts.

## Components Structure

### Proxy

IMA proxy is Ethereum part of IMA containing sets of `Main Net` and `S-Chain` smart contracts.

### Agent

IMA Agent is the main application implementing connectivity and message transfer between `Main Net` and `S-Chain`. Agent also provides easy way to do ETH, ERC20 and ERC721 transfers between `Main Net` and `S-Chain` nevertheless this can be done without it.

### NPMs

The `npms` folder contains helper modules implementing parts of IMA functionality:

#### SKALE-IMA

Module implementing core IMA functionality.

#### SKALE-OWASP

Data validity verifier module. See [OWASP document](https://www.gitbook.com/download/pdf/book/checkmarx/JS-SCP).

#### SKALE-LOG

Console and log file output with rotation.

#### SKALE-CC

ANSI colorizer for console and log output.

## For more information

-   [SKALE Network Website](https://skale.network)
-   [SKALE Network Twitter](https://twitter.com/SkaleNetwork)
-   [SKALE Network Blog](https://skale.network/blog)

Learn more about the SKALE community over on [Discord](https://discord.gg/vvUtWJB).

## License

[![License](https://img.shields.io/github/license/skalenetwork/IMA)](LICENSE)
All contributions are made under the [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.en.html). See [LICENSE](LICENSE).
Copyright (C) 2019-Present SKALE Labs.
