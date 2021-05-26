# ethersjs-jsonrpc-middleware-server

A Web3 JSON-RPC provider that handles accounts on its own using EthersJS but delegates chain queries to a 3rd party
 "destination provider", e.g. Infura.

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

To use a different provider (Ganache, etc.), you can create your own script that creates the provider and then build a
server around it like this:
```js
const destinationProvider = new MyOwnProvider()

new WalletMiddlewareServer(port, seed_phrase, destinationProvider)
  .initialize()
  .listen()
```

Destination providers need to comply with the [JsonRpcMiddleware] type from the [JsonRpcEngine] library.


[JsonRpcMiddleware]: https://github.com/MetaMask/json-rpc-engine/blob/0e57ecd678296d62a98b10775ff5c91351ccc9c6/src/JsonRpcEngine.ts#L82-L87
[JsonRpcEngine]: https://github.com/MetaMask/json-rpc-engine/