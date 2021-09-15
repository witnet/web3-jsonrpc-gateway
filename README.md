# web3-jsonrpc-gateway

A Web3 JSON-RPC provider gateway that handles accounts on its own using Ethers.js, or other SDKs, but delegates chain queries to a 3rd party "destination provider", e.g. Infura, Cloudflare, Conflux, OMGX-L2, etc.

## Compilation

```console
yarn build
```
 
## Running a single server instance, depending on destination provider type:

### Infura as destination provider:

```console
node ./dist/src/bin/ethers/infura
```

Required environment variables:

- `PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `NETWORK`: network name. Infura supports: `mainnet`, `ropsten`, `rinkeby`, `kovan` and `goerli`.
- `SEED_PHRASE`: the seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
- `PROJECT_ID`: your Infura project ID.

Optional environment variables:
- `DEFAULT_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `DEFAULT_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
- `LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.

### Conflux-like destination providers:

```console
node ./dist/src/bin/conflux
```

Required environment variables:
- `PORT`: listening port for the server. Can also be passed from command-line as first parameter.
- `NETWORK_ID`: network id. Conflux providers currently supports: `1` for testnet, and `1029` for mainnet.
- `PRIVATE_KEY`: the private key to use for generation the server's own wrapped wallet.
- `PROVIDER_URL`: actual URL of the Web3 JSON-RPC provider.

Optional environment variables:
- `DEFAULT_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `DEFAULT_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
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
- `NETWORK`: the testnet or mainnet name to connect with. 
- `DEFAULT_GAS_LIMIT`: default gas limit to be used before signing a transaction, if not specified by the caller.
- `DEFAULT_GAS_PRICE`: default gas price to be used before signing a transaction, if not specified by the caller.
- `LOG_LEVEL`: max log level to be traced, can be any of the following: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. If not specified, `verbose` will apply.
- `FORCE_DEFAULTS`: if set to `true`, the server will set `gasPrice` and `gasLimit` values to the ones set by respective environment variables, before signing a transaciton.
- `ESTIMATE_GAS_LIMIT`: if set to `true`, and defaults are not forced, the gateway will ask the destination provider an estimation of the gas limit, before signing a transaction. In this case, the client-provided gas limit (or the default gas limit, if none was provided) will be considered as a maximum threshold: if provider-estimated value is greater than the client-provided one, the transaction will be rejected by the gateway.
- `NUM_ADDRESSES`: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.


## Pre-configured JSON-RPC provider gateways:

There are several package scripts at your disposal for you to launch specific gateways to multiple WEB3-compatible blockchains, and different possible networks within them. Besides, these scripts enable you to run multiple background instances locally, and at the same time.

Instances launched with any of the following package scripts will write to a corresponding log file located inside the `logs/` folder.

**Important**: In order to these batch scripts to work properly, please create an `.env` on the root folder fulfilling the following parameters:

- `SEED_PHRASE`: seed phrase to be used with either `Infura` or `Ethers.js` providers.
- `PRIVATE_KEY`: private key to be used by `Conflux`-alike providers.
- `PROJECT_ID`: your Infura's project id to be used with `Infura`-connected servers.
- `NUM_ADDRESSES`: number of wallet addresses to be used by `Ethers.js`-connected servers.


### Running gateways to Ethereum networks:

- Rinkeby: ```npm run ethereum:rinkeby```
- Goerli: ```npm run ethereum:goerli```
- Kovan: ```npm run ethereum:kovan```
- Ropsten: ```npm run ethereum:ropsten```
- Mainnet: ```npm run ethereum:mainnet```

### Running gateways to Conflux networks:

- Testnet: ```npm run conflux:testnet```
- Mainnet: ```npm run conflux:mainnet```

### Running gateways to OMGX Layer-2 networks:

- Rinkeby: ```npm run omgx:rinkeby```
- Mainnet: ```npm run omgx:mainnet```

### Running simultaneous gateways to multiple testnets:

- All pre-configured testnets: ```npm run testnets```
- Only Ethereum testnets: ```npm run testnets:ethereum```

## How to create a server for any other provider

To integrate with a different provider, you can create your own script that creates the provider and then build a server around it. Please, have a look to provided examples in `src/bin/**`. 

