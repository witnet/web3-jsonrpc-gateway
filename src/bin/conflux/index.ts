#!/usr/bin/env node

import { WalletMiddlewareServer } from '../../conflux/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: the actual URL of the Web3 JSON-RPC provider. Can also be passed as first parameter.
const providerUrl = process.argv[2] || process.env.PROVIDER_URL || ''
if (providerUrl.length < 1) {
  throw Error(
    'No provider URL provided. Please set the `PROVIDER_URL` environment variable.'
  )
}

// Mandatory: The network id to connect with. Can also be passed as second parameter.
let networkId
if (process.argv.length >= 4) {
  networkId = parseInt(process.argv[3])
} else if (process.env.NETWORK) {
  networkId = parseInt(process.env.NETWORK)
} else {
  throw Error(
    'No network id provided. Plese set the `NETWORK` environment variable.'
  )
}

// Mandatory: Listening port for the server. Can also be passed from command-line as third parameter:
let port
if (process.argv.length >= 5) {
  port = parseInt(process.argv[4])
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT)
} else {
  throw Error(
    'No listening port provided. Please set the `PORT` environment variable.'
  )
}

// Mandatory: the private key to use for generation the server's own wrapped wallet.
const privateKey = process.env.PRIVATE_KEY
if (!privateKey) {
  throw Error(
    'No private key provided. Please set the `PRIVATE_KEY` environment variable.'
  )
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let defaultGasPrice
if (process.env.CONFLUX_GAS_PRICE) {
  defaultGasPrice = parseInt(process.env.CONFLUX_GAS_PRICE)
} else {
  defaultGasPrice = 1
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let defaultGasLimit: BigInt
if (process.env.CONFLUX_GAS_LIMIT) {
  defaultGasLimit = BigInt(process.env.CONFLUX_GAS_LIMIT)
} else {
  defaultGasLimit = BigInt(21000)
}

// Optional: if `true`, let provider estimate gas price before signing the transaction
const estimateGasPrice: boolean = JSON.parse(
  process.env.CONFLUX_ESTIMATE_GAS_PRICE || 'false'
)

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (js-conflux-sdk: ${packageData.dependencies['js-conflux-sdk']})`
)
console.log()

new WalletMiddlewareServer(
  providerUrl,
  networkId,
  privateKey,
  defaultGasLimit,
  defaultGasPrice,
  estimateGasPrice
)
  .initialize()
  .listen(port)
