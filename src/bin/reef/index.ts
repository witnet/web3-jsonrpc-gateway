#!/usr/bin/env node

import { WalletMiddlewareServer } from '../../reef/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: the actual URL of the Web3 JSON-RPC provider. Can also be passed as first parameter.
const rpcUrl = process.argv[2] || process.env.PROVIDER_URL || ''
if (!rpcUrl.length) {
  throw Error(
    'No provider URL provided. Please set the `PROVIDER_URL` environment variable.'
  )
}

// Mandatory: Listening port for the server. Can also be passed from command-line as third parameter:
let port
if (process.argv.length >= 4) {
  port = parseInt(process.argv[3])
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT)
} else {
  throw Error(
    'No listening port provided. Please set the `PORT` environment variable.'
  )
}

// Mandatory: The seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
const seedPhrase = process.env.SEED_PHRASE
if (!seedPhrase) {
  throw Error(
    'No mnemonic phrase provided. Please set the `SEED_PHRASE` environment variable.'
  )
}

// Mandatory: The graphql endpoint serving Reef's evm data
const graphUrl = process.env.GRAPHQL_URL || ''
if (!graphUrl) {
  throw Error(
    'No GraphQL endpoint provided. Please set the `GRAPHQL_URL` environment variable.'
  )
}

// Optional: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.
let numAddresses
if (process.env.NUM_WALLETS) {
  numAddresses = parseInt(process.env.NUM_WALLETS)
} else {
  numAddresses = 1
}
console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (@reef-defi/evm-provider: ${packageData.dependencies['@reef-defi/evm-provider']})`
)
console.log()

new WalletMiddlewareServer(
  rpcUrl,
  graphUrl,
  seedPhrase,
  numAddresses
)
  .initialize()
  .listen(port)
