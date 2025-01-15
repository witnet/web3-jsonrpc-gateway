# web3-jsonrpc-gateway

A Web3 JSON-RPC provider gateway that handles accounts on its own using Ethers.js, or other SDKs, but delegates chain queries to a 3rd party "destination provider", e.g. Infura, Cloudflare, Conflux, BOBA-L2, etc.

## Compilation

```console
yarn build
```

## Release

This repository is released automatically in [DockerHub](https://github.com/witnet/web3-jsonrpc-gateway/blob/main/.github/workflows/docker-publish.yml) and [npm](https://github.com/witnet/web3-jsonrpc-gateway/blob/main/.github/workflows/npm-publish.yml) using GitHub actions when a new release is detected in the repository. To release:

- Push a new tag.
- [Publish](https://github.com/witnet/web3-jsonrpc-gateway/releases/new) a new release.

## Running a single server instance, depending on destination provider type:

### Infura as destination provider:

```console
node dist/bin/ethers/infura
```

Required environment variables:

- `ETHRPC_PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `ETHRPC_NETWORK`: network name. Infura supports: `mainnet`, `ropsten`, `rinkeby`, `kovan` and `goerli`.
- `ETHRPC_SEED_PHRASE`: the seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
- `ETHRPC_PROVIDER_KEY`: your Infura project ID.

Optional environment variables:

- `ETHRPC_CALL_INTERLEAVE_BLOCKS`: number of blocks before latest knwon upon which EVM read-only calls will be bound to; this variable defaults to zero.
- `ETHRPC_INFURA_GAS_LIMIT`: default gas limit, if not specified by the client; or maximum gas limit threshold if either estimated by the provider, or provided by the client.
- `ETHRPC_INFURA_GAS_PRICE`: default gas price, if not specified by the client; or maximum gas price threshold if either estimated by the provider, or provided by the client.
- `ETHRPC_INFURA_GAS_PRICE_FACTOR`: multiplier applied to gas prices estimated by provider.
- `ETHRPC_LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.
- `ETHRPC_SEED_PHRASE_WALLETS`: number of wallet addresses to be handled by the gateway, derived from path '`m/44'/60'/0'/0/*`'.

### Conflux Core compatible destination providers:

```console
node ./dist/bin/conflux
```

Required environment variables:

- `ETHRPC_PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider. Can also be passed from command-line as a first parameter.
- `ETHRPC_PORT`: listening port for the server. Can also be passed from command-line as a second parameter.
- `ETHRPC_NETWORK`: network id. Conflux providers currently supports: `1` for testnet, and `1029` for mainnet.
- `ETHRPC_PRIVATE_KEYS`: array of private keys to be used for signing transactions.

Optional environment variables:

- `ETHRPC_CONFLUX_DEFAULT_EPOCH_LABEL`: default epoch label to be used on read-only RPC calls, if none is specified by the caller; this variable will default to `"latest_finalized"` if none is set.
- `ETHRPC_CONFLUX_ESTIMATE_GAS_PRICE`: if set to `true`, the provider will be asked to estimate the gas price, before signing the transaction; if the provider-estimated gas price is greater than `ETHRPC_CONFLUX_GAS_PRICE`, the transaction will be rejected by the gateway.
- `ETHRPC_CONFLUX_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `ETHRPC_CONFLUX_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
- `ETHRPC_CALL_INTERLEAVE_BLOCKS`: number of epochs before current epoch number upon which EVM read-only calls will be bound to; this variable defaults to zero.
- `ETHRPC_LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.

### Reef-compatible destination providers:

```console
node ./dist/bin/reef
```

Required environment variables:

- `ETHRPC_PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider. Can also be passed from command-line as a first parameter.
- `REEF_GRAPHQL_URL`: the GraphQL endpoint serving EVM's data. Can also be passed from command-line as a second parameter.
- `ETHRPC_PORT`: listening port for the server. Can also be passed from command-line as a third parameter.
- `ETHRPC_SEED_PHRASE`: seed phrase to be used with either `Infura` or `Ethers.js` providers.

Optional environment variables:

- `ETHRPC_LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.
- `ETHRPC_SEED_PHRASE_WALLETS`: number of EVM wallet addresses to be handled by the gateway. EVM addresses will be default ones attached to respective Reef addresses. First Reef address will be derived from '`${ETHRPC_SEED_PHRASE}`', while the following one from '`${ETHRPC_SEED_PHRASE}//${j}`' (with `j > 0`).

### Generic destination providers:

```console
node ./dist/bin/ethers
```

Generic destination providers need to comply with the `JsonRpcProvider` type from the `Ethers.js` library:

- [jsonrpcprovider](https://github.com/ethers-io/ethers.js/blob/d395d16fa357ec5dda9b59922cf21c39dc34c071/packages/providers/src.ts/json-rpc-provider.ts#L279-L612)
- [Ethers.js](https://github.com/ethers-io/ethers.js)

Required environment variables:

- `ETHRPC_PORT`: listening port for the server. Can also be passed from command-line as a second parameter.
- `ETHRPC_SEED_PHRASE`: the seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
- `ETHRPC_PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider. Can also be passed from command-line as a first parameter.

Optional environment variables:

- `ETHRPC_NETWORK`: the network name to connect with.
- `ETHRPC_SEED_PHRASE_WALLETS`: number of wallet addresses to be handled by the gateway, derived from path '`m/44'/60'/0'/0/*`'.
- `ETHRPC_LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.
- `ETHRPC_ETHERS_ALWAYS_SYNCED`: if set to `true`, the gateway will intercept calls to `eth_syncing` as to return `false` in all cases.
- `ETHRPC_ETHERS_ESTIMATE_GAS_LIMIT`: if set to `true`, the provider will be asked to estimate the gas limit, before signing the transaction; if the provider-estimated gas limit is greater than `ETHRPC_ETHERS_GAS_LIMIT`, the transaction will be rejected by the gateway.
- `ETHRPC_ETHERS_ESTIMATE_GAS_PRICE`: if set to `true`, the provider will be asked to estimate the gas price, before signing the transaction; if the provider-estimated gas price is greater than `ETHRPC_ETHERS_GAS_PRICE`, the transaction will be rejected by the gateway.
- `ETHRPC_ETHERS_GAS_LIMIT`: default gas limit, if not specified by the client; or maximum gas limit threshold if either estimated by the provider, or provided by the client.
- `ETHRPC_ETHERS_GAS_PRICE`: default gas price, if not specified by the client; or maximum gas price threshold if either estimated by the provider, or provided by the client.
- `ETHRPC_ETHERS_GAS_PRICE_FACTOR`: multiplier applied to estimated gas price, if `ETHRPC_ETHERS_ESTIMATE_GAS_PRICE` is `true`.
- `ETHRPC_ETHERS_MOCK_FILTERS`: makes `eth_getFilterChanges` to always return latest known block.
- `ETHRPC_CALL_INTERLEAVE_BLOCKS`: number of blocks before latest knwon upon which EVM read-only calls will be bound to; this variable defaults to zero.

## Pre-configured JSON-RPC provider gateways:

There are several package scripts at your disposal for you to launch specific gateways to multiple WEB3-compatible blockchains, and different possible networks within them.

**Important**: In order to these batch scripts to work properly, please rename `.env_batch_example` to `.env`, and fulfill the following parameters:

- `ETHRPC_CALL_INTERLEAVE_BLOCKS`: number of blocks before latest knwon upon which EVM read-only calls will be bound to; this variable defaults to zero.
- `ETHRPC_PROVIDER_KEY`: your Infura's project id to be used with `Infura`-connected servers.
- `ETHRPC_LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.
- `ETHRPC_PRIVATE_KEYS`: array of private keys to be used by `Conflux` and `Celo` -alike providers.
- `ETHRPC_SEED_PHRASE`: seed phrase to be used with either `Infura` or `Ethers.js` providers.

### Running gateways to Ethereum networks:

- Rinkeby: `npm run ethereum:rinkeby`
- Goerli: `npm run ethereum:goerli`
- Kovan: `npm run ethereum:kovan`
- Ropsten: `npm run ethereum:ropsten`
- Mainnet: `npm run ethereum:mainnet`

### Running gateways to BOBA Layer-2 networks:

- Rinkeby: `npm run boba:rinkeby`
- Mainnet: `npm run boba:mainnet`

### Running gateways to CELO networks:

- Alfajores: `npm run celo:alfajores`
- Mainnet: `npm run celo:mainnet`

### Running gateways to Conflux networks:

- Testnet: `npm run conflux:testnet`
- Mainnet: `npm run conflux:mainnet`

### Running gateways to HARMONY networks:

- Testnet (Shard #0): `npm run harmony:testnet#0`

### Running gateways to KCC networks:

- Testnet: `npm run kcc:testnet`

### Running gateways to METIS networks:

- Stardust (Rinkeby): `npm run metis:rinkeby`

### Running gateways to POLYGON networks:

- Mumbai (Goerli): `npm run polygon:goerli`

### Running gateways to REEF CHAIN networks:

- Testnet: `npm run reef:testnet`

## How to create a server for any other provider

To integrate with a different provider, you can create your own script that creates the provider and then build a server around it. Please, have a look to provided examples in `src/bin/**`.
