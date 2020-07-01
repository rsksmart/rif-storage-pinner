#!/usr/bin/env bash

path=$(dirname "$0")

export IPFS_PATH="$path/consumer"
ipfs init
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5002
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8081
ipfs config --json Addresses.Swarm '["/ip4/0.0.0.0/tcp/4002", "/ip6/::/tcp/4002", "/ip4/0.0.0.0/udp/4002/quic", "/ip6/::/udp/4002/quic"]'

export IPFS_PATH="$path/provider"
ipfs init
