BASE_OPTIONS="--gas-price-multiplier=$GAS_PRICE_MULTIPLIER \
    --verbose=$VERBOSE \
    --url-main-net=$MAINNET_RPC_URL \
    --url-s-chain=$SCHAIN_RPC_URL \
    --id-main-net=Mainnet \
    --id-s-chain=$SCHAIN_NAME \
    --cid-main-net=$CID_MAIN_NET \
    --cid-s-chain=$CID_SCHAIN \
    --abi-main-net=$MAINNET_PROXY_PATH \
    --abi-s-chain=$SCHAIN_PROXY_PATH"

echo $BASE_OPTIONS

