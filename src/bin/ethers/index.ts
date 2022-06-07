#!/usr/bin/env node

import { ethers } from 'ethers'
import { WalletMiddlewareServer } from '../../ethers/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: the actual URL of the Web3 JSON-RPC provider. Can also be passed as first parameter.
const providerUrl = process.argv[2] || process.env.PROVIDER_URL || ''
if (providerUrl.length < 1) {
  throw Error(
    'No provider URL provided. Please set the `PROVIDER_URL` environment variable.'
  )
}

// Mandatory: Listening port for the server. Can also be passed from command-line as second parameter:
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
const seed_phrase = process.env.SEED_PHRASE
if (!seed_phrase) {
  throw Error(
    'No mnemonic phrase provided. Please set the `SEED_PHRASE` environment variable.'
  )
}

// Optional: The network name to connect with. Can also be passed as third parameter.
const network = process.argv[4] || process.env.NETWORK

// Optional: Number of blocks before EVM's latest state on which EVM calls will be perfomed
let interleave_blocks = 0
if (process.env.EVM_CALL_INTERLEAVE_BLOCKS) {
  interleave_blocks = parseInt(process.env.EVM_CALL_INTERLEAVE_BLOCKS)
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let gas_price = 20e9
if (process.env.ETHERS_GAS_PRICE) {
  gas_price = parseInt(process.env.ETHERS_GAS_PRICE)
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let gas_limit = 6721975
if (process.env.ETHERS_GAS_LIMIT) {
  gas_limit = parseInt(process.env.ETHERS_GAS_LIMIT)
}

// Optional: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.
let num_addresses
if (process.env.ETHERS_NUM_ADDRESSES) {
  num_addresses = parseInt(process.env.ETHERS_NUM_ADDRESSES)
} else {
  num_addresses = 5
}

// Optional: if `true`, let provider estimate gas limit before signing the transaction
let estimate_gas_limit: boolean = false
if (process.env.ETHERS_ESTIMATE_GAS_LIMIT) {
  estimate_gas_limit = JSON.parse(process.env.ETHERS_ESTIMATE_GAS_LIMIT)
}

// Optional: if `true`, let provider estimate gas price before signing the transaction
let estimate_gas_price: boolean = false
if (process.env.ETHERS_ESTIMATE_GAS_PRICE) {
  estimate_gas_price = JSON.parse(process.env.ETHERS_ESTIMATE_GAS_PRICE)
}

// Optional: if `true`, force responses to `eth_syncing` as being always `false`
let always_synced: boolean = false
if (process.env.ETHERS_ALWAYS_SYNCED) {
  always_synced = JSON.parse(process.env.ETHERS_ALWAYS_SYNCED)
}

// Optional: if `true`, force responses to `eth_getFilterChanges` to always reply w/ latest block hash
let mock_filters: boolean = false
if (process.env.ETHERS_MOCK_FILTERS) {
  mock_filters = JSON.parse(process.env.ETHERS_MOCK_FILTERS)
}

// Optional: gas price factor to be applied to when ETHERS_ESTIMATE_GAS_PRICE is true
let gas_price_factor = 1.0
if (process.env.ETHERS_GAS_PRICE_FACTOR) {
  gas_price_factor = parseFloat(process.env.ETHERS_GAS_PRICE_FACTOR)
}

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (ethers: ${packageData.dependencies.ethers})`
)
console.log()

const destinationProvider = new ethers.providers.JsonRpcProvider(
  providerUrl,
  network
)

new WalletMiddlewareServer(
  destinationProvider,
  seed_phrase,
  interleave_blocks,  
  gas_price,
  gas_limit,
  num_addresses,
  estimate_gas_limit,
  estimate_gas_price,
  always_synced,
  mock_filters,
  gas_price_factor
)
  .initialize()
  .listen(port)
