#!/usr/bin/env node

import { WalletMiddlewareServer } from '../../conflux/server'

require('dotenv').config()
const packageData = require('../../../package.json')

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

const privateKey = process.env.PRIVATE_KEY
if (!privateKey) {
  throw Error(
    'No mnemonic phrase provided. Please set the `SEED_PHRASE` environment variable.'
  )
}

const providerUrl = process.env.PROVIDER_URL || ''
if (providerUrl.length < 1) {
  throw Error(
    'No provider URL provided. Please set the `PROVIDER_URL` environment variable.'
  )
}

let defaultGasPrice
if (process.env.DEFAULT_GAS_PRICE) {
  defaultGasPrice = parseInt(process.env.DEFAULT_GAS_PRICE)
} else {
  defaultGasPrice = 1
}

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
