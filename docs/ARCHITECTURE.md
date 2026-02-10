# SKALE IMA Architecture

## Repository Architecture

- `contracts/` – Core Solidity contracts for SKALE IMA bridge infrastructure and cross-chain messaging.
   - `contracts/mainnet/` – Ethereum Mainnet contracts for deposits, withdrawals, and message routing.
      - `contracts/mainnet/DepositBoxes/` – Token deposit boxes (DepositBoxEth, DepositBoxERC20, DepositBoxERC721, DepositBoxERC1155, DepositBoxERC721WithMetadata).
   - `contracts/schain/` – SKALE Chain contracts for token management and message routing.
      - `contracts/schain/TokenManagers/` – Token managers (TokenManagerEth, TokenManagerERC20, TokenManagerERC721, TokenManagerERC1155, TokenManagerERC721WithMetadata).
      - `contracts/schain/bls/` – BLS signature verification for cross-chain messages.
      - `contracts/schain/tokens/` – Token implementations (EthErc20, ERC20OnChain, ERC721OnChain, ERC1155OnChain).
   - `contracts/extensions/` – Contract extensions and modular components.
   - `contracts/test/` – Mock and test contracts for development and testing.
   - `contracts/thirdparty/` – External dependencies.

- `data/` – Deployment artifacts containing contract addresses and ABIs.

- `scripts/` – Build, deployment, and utility scripts for CI/CD and automation.

- `test/` – TypeScript test suites for all contracts, including unit and integration tests.

- `test-tokens/` – Test ERC20, ERC721, and ERC1155 token contracts for testing bridge functionality.

- `migrations/` – Hardhat deployment and upgrade scripts for Mainnet and SKALE Chain contracts.

- `gas/` – Gas consumption analysis and benchmarking tools.

- `audits/` – Some Security audit reports from third-party auditors.
