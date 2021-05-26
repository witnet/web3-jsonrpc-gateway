# ethersjs-jsonrpc-middleware-server

A Web3 JSON-RPC provider that handles accounts on its own using Ethers.js but delegates chain queries to a 3rd party
"destination provider", e.g. Infura, Alchemy, Cloudflare, etc.

## Compilation

```console
yarn build
```

## Usage as a server with Infura as the destination provider

```console
yarn start
```

The following environment variables are required:

- `PORT`: listening port for the server.
- `NETWORK`: network name. Infura supports `mainnet`, `ropsten`, `rinkeby`, `kovan` and `goerli`.
- `SEED_PHRARE`: the seed phrase to use for the wrapped Ether.js wallet, in BIP-39 mnemonics format.
- `PROJECT_ID`: your Infura project ID.

## How to create a server for any other provider

To use a different provider, you can create your own script that creates the provider and then build a server around
it. Here's an example for using Cloudflare as the destination provider:

```js
const destinationProvider = new CloudflareProvider()

new WalletMiddlewareServer(port, seed_phrase, destinationProvider)
  .initialize()
  .listen()
```

Destination providers need to comply with the [JsonRpcProvider] type from the [Ethers.js] library.

[jsonrpcprovider]: https://github.com/ethers-io/ethers.js/blob/d395d16fa357ec5dda9b59922cf21c39dc34c071/packages

/providers/src.ts/json-rpc-provider.ts#L279-L612
[Ether.js]: https://github.com/ethers-io/ethers.js
