<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE IMA proxy test-tokens

Folder with Token samples which are suitable to use with IMA

## Initialization

To initialize you need to run only one command and setup .env file:

`yarn install`

Setup `.env` file

```bash
PRIVATE_KEY_FOR_ETHEREUM="YOUR_PRIVATE_KEY_ON_MAIN_CHAIN"
URL_W3_ETHEREUM="ENDPOINT_TO_MAIN_CHAIN"
PRIVATE_KEY_FOR_SCHAIN="YOUR_PRIVATE_KEY_ON_SKALE_CHAIN"
URL_W3_S_CHAIN="ENDPOINT_TO_SKALE_CHAIN"
```

## Deploy

### ERC20 Deploy

Deploy ERC20 sample based on openzeppelin contracts:

To main-chain:

```bash
npx hardhat erc20 --name ERC20TokenName --symbol ERC20TokenSymbol --network mainnet
```

To skale-chain:

```bash
npx hardhat erc20 --name ERC20TokenName --symbol ERC20TokenSymbol --network schain
```

To deploy custom token - please develop your ERC20 contract and add option param with you contract name:

```bash
--contract "Your contract name"

npx hardhat erc20 --contract ERC20CustomName --name ERC20TokenName --symbol ERC20TokenSymbol --network mainnet
npx hardhat erc20 --contract ERC20CustomName --name ERC20TokenName --symbol ERC20TokenSymbol --network schain
```

Help:

```bash
npx hardhat help erc20
```

### ERC721 Deploy

Deploy ERC721 sample based on openzeppelin contracts:

To main-chain:

```bash
npx hardhat erc721 --name ERC721TokenName --symbol ERC721TokenSymbol --network mainnet
```

To skale-chain:

```bash
npx hardhat erc721 --name ERC721TokenName --symbol ERC721TokenSymbol --network schain
```

To deploy custom token - please develop your ERC721 contract and add option param with you contract name:

```bash
--contract "Your contract name"

npx hardhat erc721 --contract ERC721CustomName --name ERC721TokenName --symbol ERC721TokenSymbol --network mainnet
npx hardhat erc721 --contract ERC721CustomName --name ERC721TokenName --symbol ERC721TokenSymbol --network schain
```

Help:

```bash
npx hardhat help erc721
```

### ERC1155 Deploy

Deploy ERC1155 sample based on openzeppelin contracts:

To main-chain:

```bash
npx hardhat erc1155 --uri ERC1155TokenURI --network mainnet
```

To skale-chain:

```bash
npx hardhat erc1155 --uri ERC1155TokenURI --network schain
```

To deploy custom token - please develop your ERC1155 contract and add option param with you contract name:

```bash
--contract "Your contract name"

npx hardhat erc1155 --contract ERC1155CustomName --uri ERC1155TokenURI --network mainnet
npx hardhat erc1155 --contract ERC1155CustomName --uri ERC1155TokenURI --network schain
```

Help:

```bash
npx hardhat help erc1155
```

## Verify your token on Etherscan

To verify your contract need to run:

### ERC20 Verify

```bash
npx hardhat verify ERC20TokenAddress "ERC20TokenName" "ERC20TokenSymbol" --network mainnet
```

### ERC721 Verify

```bash
npx hardhat verify ERC721TokenAddress "ERC721TokenName" "ERC721TokenSymbol" --network mainnet
```

### ERC1155 Verify

```bash
npx hardhat verify ERC1155TokenAddress "ERC1155TokenURI" --network mainnet
```

Help:

```bash
npx hardhat help verify
```

## Add minter

### ERC20 Add minter

Add minter to ERC20 token:

To main-chain:

```bash
npx hardhat add-minter-erc20 --token-address ERC20TokenAddress --address minterAddress --network mainnet
```

To skale-chain:

```bash
npx hardhat add-minter-erc20 --token-address ERC20TokenAddress --address minterAddress --network schain
```

Help:

```bash
npx hardhat help add-minter-erc20
```

### ERC721 Add minter

Mint ERC721 token:

To main-chain:

```bash
npx hardhat add-minter-erc721 --token-address ERC721TokenAddress --address minterAddress --network mainnet
```

To skale-chain:

```bash
npx hardhat add-minter-erc721 --token-address ERC721TokenAddress --address minterAddress --network schain
```

Help:

```bash
npx hardhat help add-minter-erc721
```

### ERC1155 Add minter

Mint ERC1155 token:

To main-chain:

```bash
npx hardhat add-minter-erc1155 --token-address ERC1155TokenAddress --address minterAddress --network mainnet
```

To skale-chain:

```bash
npx hardhat add-minter-erc1155 --token-address ERC1155TokenAddress --address minterAddress --network schain
```

Help:

```bash
npx hardhat help add-minter-erc1155
```

## Mint

### ERC20 Mint

Mint ERC20 token:
To mint 5 tokens - you need to specify `--amount 5` - will mint 5 * DECIMALS

To main-chain:

```bash
npx hardhat mint-erc20 --token-address ERC20TokenAddress --receiver-address receiverAddress --amount amountOfTokens --network mainnet
```

To skale-chain:

```bash
npx hardhat mint-erc20 --token-address ERC20TokenAddress --receiver-address receiverAddress --amount amountOfTokens --network schain
```

Help:

```bash
npx hardhat help mint-erc20
```

### ERC721 Mint

Mint ERC721 token:

To main-chain:

```bash
npx hardhat mint-erc721 --token-address ERC721TokenAddress --receiver-address receiverAddress --token-id tokenId --network mainnet
```

To skale-chain:

```bash
npx hardhat mint-erc721 --token-address ERC721TokenAddress --receiver-address receiverAddress --token-id tokenId --network schain
```

Help:

```bash
npx hardhat help mint-erc721
```

### ERC1155 Mint

Mint ERC1155 token:

To main-chain:

```bash
npx hardhat mint-erc1155 --token-address ERC1155TokenAddress --receiver-address receiverAddress --token-id tokenId --amount amountOfTokens --network mainnet
```

To skale-chain:

```bash
npx hardhat mint-erc1155 --token-address ERC1155TokenAddress --receiver-address receiverAddress --token-id tokenId --amount amountOfTokens --network schain
```

Optional params:
-   `data` - bytes data `0x0102...` (default `0x`)
-   `batch` - batch mint or not (default `false`)

Examples:

```bash
npx hardhat mint-erc1155 --token-address ERC1155TokenAddress --receiver-address receiverAddress --token-id tokenId --amount amountOfTokens --data 0xabbccddeef12233445 --network mainnet
npx hardhat mint-erc1155 --token-address ERC1155TokenAddress --receiver-address receiverAddress --token-id "[tokenId1,tokenId2]" --amount "[amountOfTokens1,amountOfTokens2]" --batch true --network schain
```

Help:

```bash
npx hardhat help mint-erc1155
```