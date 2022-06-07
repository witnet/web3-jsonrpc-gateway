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

// Optional: Number of blocks before EVM's latest state on which EVM calls will be perfomed
let interleave_blocks = 0
if (process.env.EVM_CALL_INTERLEAVE_BLOCKS) {
  interleave_blocks = parseInt(process.env.EVM_CALL_INTERLEAVE_BLOCKS)
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let gas_price = 100e9
if (process.env.INFURA_GAS_PRICE) {
  gas_price = parseInt(process.env.INFURA_GAS_PRICE)
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let gas_limit = 6721975
if (process.env.INFURA_GAS_LIMIT) {
  gas_limit = parseInt(process.env.INFURA_GAS_LIMIT)
}

// Optional: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.
let num_addresses
if (process.env.INFURA_NUM_ADDRESSES) {
  num_addresses = parseInt(process.env.INFURA_NUM_ADDRESSES)
} else {
  num_addresses = 5
}

// Optional: gas price factor to be applied to when ETHERS_ESTIMATE_GAS_PRICE is true
let gas_price_factor = 1.0
if (process.env.ETHERS_INFURA_PRICE_FACTOR) {
  gas_price_factor = parseFloat(process.env.ETHERS_INFURA_PRICE_FACTOR)
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
  destinationProvider,
  seed_phrase,
  interleave_blocks,
  gas_price,
  gas_limit,
  num_addresses, // number of addresses
  true, // estimate gas limit
  true, // estimate gas price
  false, // always synced
  false, // mock filters
  gas_price_factor, // gas price factor
)
  .initialize()
  .listen(port)
