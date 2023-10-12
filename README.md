<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE Interchain Messaging Contracts

[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

## A critical note about production readiness

The IMA is still in active development and therefore should be regarded as _alpha software_. The development is still subject to further security hardening, testing, and breaking changes.

**The proxy contracts have been reviewed and audited by a third-parties for security.**
Please see [SECURITY.md](.github/SECURITY.md) for audit reports and reporting policies.

## Software Architecture

IMA consists of the following three parts:

1)  `Mainnet` smart contracts.
2)  `SKALE Chain` smart contracts.
3)  A containerized IMA Agent application.

Smart contracts are interfaces for any software working with `Mainnet` and `SKALE Chain` like other smart contracts deployed there or software connecting these Ethereum networks.
The Agent is a Node JS application connecting the smart contracts on Mainnet with SKALE Chains.

## Components Structure

### Proxy

IMA proxy is the Solidity part of IMA containing `Mainnet` and `SKALE Chain` smart contracts.

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
