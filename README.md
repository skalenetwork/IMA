
# SKALE Interchain Messaging Agent (IMA)

[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

## An important note about production readiness

The IMA is still in active development and therefore should be regarded as _alpha software_. The development is still subject to security hardening, further testing, and breaking changes.
**This software has not yet  been reviewed or audited for security.**
Please see [SECURITY.md](SECURITY.md) for reporting policies.

## Software Architecture

### Proxy

IMA proxy is Ethereum part of IMA containing sets of `Main Net` and `S-Chain` smart contracts.

### Agent

IMA Agent is the main application implementing connectivity and message transfer between `Main Net` and `S-Chain`.

### NPMs

The `npms` folder contains helper modules implementing parts of IMA functionality:

#### SKALE-IMA

#### SKALE-OWASP

#### SKALE-LOG

#### SKALE-CC


## Steps to run IMA on the Main Net

## Steps to run IMA on the S-Chain

## Prerequisites

1) `Main Net` Ethereum network with known HTTP(S) URL of **Web3** interface.
2) `S-Chain` network with known HTTP(S) URL of **Web3** interface.
3) Preliminary deployed **Skale Manager** software with known address of **ContractManager** smart contract saved into the `proxy/data/skaleManagerComponents.json` file like shown in the following example:

```json
    {
        "contract_manager_address": "0xe89d660C1a4642C12A2846e8AF4d3F76c6BDbeF2"
    }
```

4) `libBLS` command utilities

## Preparations

1) Deploy contracts on the `Main Net`
2) Create Skale nodes
3) Create sChain
4) Wait till sChain will be up and running
5) Deploy contracts on the sChain
6) Put proxy_schain.json in the sChain folder
7) Run container with agent on the node

## For more information

* [SKALE Network Website](https://skale.network)
* [SKALE Network Twitter](https://twitter.com/SkaleNetwork)
* [SKALE Network Blog](https://skale.network/blog)

Learn more about the SKALE community over on [Discord](https://discord.gg/vvUtWJB).

## License

[![License](https://img.shields.io/github/license/skalenetwork/IMA)](LICENSE)
All contributions are made under the [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.en.html). See [LICENSE](LICENSE).
Copyright (C) 2019-Present SKALE Labs.
