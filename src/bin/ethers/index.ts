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

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let gas_price
if (process.env.DEFAULT_GAS_PRICE) {
  gas_price = parseInt(process.env.DEFAULT_GAS_PRICE)
} else {
  gas_price = 20e9
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let gas_limit
if (process.env.DEFAULT_GAS_LIMIT) {
  gas_limit = parseInt(process.env.DEFAULT_GAS_LIMIT)
} else {
  gas_limit = 6721975
}

// Optional: if set to `true`, the server will set `gasPrice` and `gasLimit` values to the ones set by 
// respective environment variables, before signing a transaciton.
let force_defaults
if (process.env.FORCE_DEFAULTS) {
  force_defaults = (process.env.FORCE_DEFAULTS === 'true')
} else {
  force_defaults = false
}

// Optional: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.
let num_addresses
if (process.env.NUM_ADDRESSES) {
  num_addresses = parseInt(process.env.NUM_ADDRESSES)
} else {
  num_addresses = 1
}

console.log("=".repeat(120))
console.log(`${packageData.name} v${packageData.version} (ethers: ${packageData.dependencies.ethers})`)
console.log()

const destinationProvider = new ethers.providers.JsonRpcProvider(
    providerUrl,
    network
)

new WalletMiddlewareServer(
    seed_phrase,
    destinationProvider,
    gas_price,
    gas_limit,
    force_defaults,
    num_addresses
  )
  .initialize()
  .listen(port)
