<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE IMA proxy test-tokens

Folder with Token samples which are suitable to use with IMA

## Initialization

To initializa you need to run only one function:

`yarn install`

Setup `.env` file

```bash
PRIVATE_KEY_FOR_ETHEREUM="YOUR_PRIVATE_KEY_ON_MAIN_CHAIN"
URL_W3_ETHEREUM="ENDPOINT_TO_MAIN_CHAIN"
PRIVATE_KEY_FOR_SCHAIN="YOUR_PRIVATE_KEY_ON_SKALE_CHAIN"
URL_W3_S_CHAIN="ENDPOINT_TO_SKALE_CHAIN"
```

## Deploy

### ERC20

Deploy ERC20 sample based on openzeppelin contracts:

To main-chain:

`npx hardhat erc20 --name ERC20TokenName --symbol ERC20TokenSymbol --network mainnet`

To skale-chain:

`npx hardhat erc20 --name ERC20TokenName --symbol ERC20TokenSymbol --network schain`

### ERC721

Deploy ERC721 sample based on openzeppelin contracts:

To main-chain:

`npx hardhat erc721 --name ERC721TokenName --symbol ERC721TokenSymbol --network mainnet`

To skale-chain:

`npx hardhat erc721 --name ERC721TokenName --symbol ERC721TokenSymbol --network schain`

## Verify your token on Etherscan

To verify your contract need to run:

### ERC20

`npx hardhat verify ERC20TokenAddress "ERC20TokenName" "ERC20TokenSymbol" --network mainnet`

### ERC721

`npx hardhat verify ERC721TokenAddress "ERC721TokenName" "ERC721TokenSymbol" --network mainnet`

## Mint

### ERC20

Mint ERC20 token:
To mint 5 tokens - you need to specify `--amount 5` - will mint 5 * DECIMALS

To main-chain:

`npx hardhat mint-erc20 --token-address ERC20TokenAddress --receiver-address receiverAddress --amount amountOfTokens --network mainnet`

To skale-chain:

`npx hardhat mint-erc20 --token-address ERC20TokenAddress --receiver-address receiverAddress --amount amountOfTokens --network schain`

### ERC721

Mint ERC721 token:

To main-chain:

`npx hardhat mint-erc721 --token-address ERC721TokenAddress --receiver-address receiverAddress --token-id amountOfTokens --network mainnet`

To skale-chain:

`npx hardhat mint-erc721 --token-address ERC721TokenAddress --receiver-address receiverAddress --token-id amountOfTokens --network schain`