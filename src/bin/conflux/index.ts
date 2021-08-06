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
} else if (process.env.NETWORK_ID) {
  networkId = parseInt(process.env.NETWORK_ID)
} else {
  throw Error(
    'No network id provided. Plese set the `NETWORK_ID` environment variable.'
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
if (process.env.DEFAULT_GAS_PRICE) {
  defaultGasPrice = parseInt(process.env.DEFAULT_GAS_PRICE)
} else {
  defaultGasPrice = 1
}

// Optional: default gas limig to be used before signing a transaction, if not specified by the caller.
let defaultGasLimit:BigInt
if (process.env.DEFAULT_GAS_LIMIT) {
  defaultGasLimit = BigInt(process.env.DEFAULT_GAS_LIMIT)
} else {
  defaultGasLimit = BigInt(21000)
}

console.log("=".repeat(120))
console.log(`${packageData.name} v${packageData.version} (js-conflux-sdk: ${packageData.dependencies["js-conflux-sdk"]})`)
console.log()

new WalletMiddlewareServer(
    providerUrl,
    networkId,
    privateKey,
    defaultGasLimit,
    defaultGasPrice
  )
  .initialize()
  .listen(port)
