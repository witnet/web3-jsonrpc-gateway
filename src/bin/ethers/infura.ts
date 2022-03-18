#!/usr/bin/env node

import { ethers } from 'ethers'
import { WalletMiddlewareServer } from '../../ethers/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: Listening port for the server. Can also be passed from command-line as first parameter:
let port
if (process.argv.length >= 3) {
  port = parseInt(process.argv[2])
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT)
} else {
  throw Error(
    'No listening port provided. Please set the `PORT` environment variable.'
  )
}

// Mandatory: The network name to connect with. Can also be passed as second parameter.
// E.g.: `mainnet`, `ropsten`, `rinkeby`, `kovan` and `goerli`.
const network = process.argv[3] || process.env.NETWORK
if (!network) {
  throw Error(
    'No network specified. Please set the `NETWORK` environment variable.'
  )
}

// Mandatory: The seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
const seed_phrase = process.env.SEED_PHRASE
if (!seed_phrase) {
  throw Error(
    'No mnemonic phrase provided. Please set the `SEED_PHRASE` environment variable.'
  )
}

// Mandatory: the Infura project ID.
const projectId = process.env.INFURA_PROJECT_ID || ''
if (projectId.length < 1) {
  throw Error(
    'No Infura INFURA_PROJECT_ID provided. Please set the `INFURA_PROJECT_ID` environment variable.'
  )
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let gas_price
if (process.env.INFURA_GAS_PRICE) {
  gas_price = parseInt(process.env.INFURA_GAS_PRICE)
} else {
  gas_price = 20e9
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let gas_limit
if (process.env.INFURA_GAS_LIMIT) {
  gas_limit = parseInt(process.env.INFURA_GAS_LIMIT)
} else {
  gas_limit = 6721975
}

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (ethers: ${packageData.dependencies.ethers})`
)
console.log()

const destinationProvider = new ethers.providers.InfuraProvider(
  network,
  projectId
)

new WalletMiddlewareServer(
  seed_phrase,
  destinationProvider,
  gas_price,
  gas_limit,
  false, // force defaults
  1, // number of addresses
  false, // estimate gas limit
  false, // estimate gas price
  false, // always synced
  false, // mock filters
  1.0,   // gas price factor 
)
  .initialize()
  .listen(port)
