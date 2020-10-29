#!/bin/bash

# This helps to check the env variables pushed from env file
# Will be on the log file
env

# Start pinner
npm run bin daemon --provider=${IFS_PROVIDER} \
        --ipfs=${RIFS_IPFS} \
        --network=testnet \
        --strategy=${RIFS_STRATEGY} \
        --offerId=${RIFS_OFFER}