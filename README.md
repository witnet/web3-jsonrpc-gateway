# web3-jsonrpc-gateway

A Web3 JSON-RPC provider gateway that handles accounts on its own using Ethers.js, or other SDKs, but delegates chain queries to a 3rd party "destination provider", e.g. Infura, Cloudflare, Conflux, BOBA-L2, etc.

## Compilation

```console
yarn build
```

## Running a single server instance, depending on destination provider type:

### Infura as destination provider:

```console
node dist/src/bin/ethers/infura
```

Required environment variables:

- `PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `NETWORK`: network name. Infura supports: `mainnet`, `ropsten`, `rinkeby`, `kovan` and `goerli`.
- `SEED_PHRASE`: the seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
- `INFURA_PROJECT_ID`: your Infura project ID.

Optional environment variables:

- `INFURA_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `INFURA_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
- `LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.

### Celo-compatible destination providers:

```console
node dist/src/bin/celo
```

Required environment variables:

- `PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `NETWORK`: Celo providers currently supports: `44787` for testnet, and `42220` for mainnet.
- `PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider.
- `PRIVATE_KEY`: the private key to use for generation the server's own wrapped wallet.

Optional environment variables:

- `CELO_FEE_CURRENCY`: ERC-20 token address to be used for paying transaction gas. Native CELO will be used if none specified.
- `CELO_GAS_LIMIT_FACTOR`: factor by which the provider-estimated gas limit will be multiplied, before signing transactions.
- `CELO_GAS_PRICE_FACTOR`: factor by which the provider-estimated gas price minimum will be multiplied, before signing transactions.
- `CELO_GAS_PRICE_MAX`: maximum gas price the gateway is allowed to bid when signing transactions.

### Conflux-compatible destination providers:

```console
node ./dist/src/bin/conflux
```

Required environment variables:

- `PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `NETWORK`: network id. Conflux providers currently supports: `1` for testnet, and `1029` for mainnet.
- `PRIVATE_KEY`: the private key to use for generation the server's own wrapped wallet.
- `PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider.

Optional environment variables:

- `CONFLUX_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `CONFLUX_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
- `LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.

### Generic destination providers:

```console
node ./dist/src/bin/ethers
```

Generic destination providers need to comply with the `JsonRpcProvider` type from the `Ethers.js` library:

- [jsonrpcprovider](https://github.com/ethers-io/ethers.js/blob/d395d16fa357ec5dda9b59922cf21c39dc34c071/packages/providers/src.ts/json-rpc-provider.ts#L279-L612)
- [Ethers.js](https://github.com/ethers-io/ethers.js)

Required environment variables:

- `PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `SEED_PHRASE`: the seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
- `PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider.

Optional environment variables:

- `NETWORK`: the network name to connect with.
- `LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.
- `ETHERS_ESTIMATE_GAS_LIMIT`: if set to `true`, the provider will be asked to estimate the gas limit, before signing the transaction; if the provider-estimated gas limit is greater than the one specified from client side (or `ETHERS_GAS_LIMIT`, if none given), the transaction will be rejected by the gateway.
- `ETHERS_FORCE_DEFAULTS`: if set to `true`, the server will set `gasPrice` and `gasLimit` values to the ones set by respective environment variables, before signing a transaction.
- `ETHERS_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `ETHERS_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
- `ETHERS_NUM_ADDRESSES`: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.

## Pre-configured JSON-RPC provider gateways:

There are several package scripts at your disposal for you to launch specific gateways to multiple WEB3-compatible blockchains, and different possible networks within them.

**Important**: In order to these batch scripts to work properly, please rename `.env_batch_example` to `.env`, and fulfill the following parameters:

- `SEED_PHRASE`: seed phrase to be used with either `Infura` or `Ethers.js` providers.
- `PRIVATE_KEY`: private key to be used by `Conflux`-alike providers.
- `INFURA_PROJECT_ID`: your Infura's project id to be used with `Infura`-connected servers.
- `LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.

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

## How to create a server for any other provider

To integrate with a different provider, you can create your own script that creates the provider and then build a server around it. Please, have a look to provided examples in `src/bin/**`.
