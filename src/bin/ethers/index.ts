#!/usr/bin/env node

import { ethers } from 'ethers'
import { WalletMiddlewareServer } from '../../ethers/server'

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

const network = process.argv[3] || process.env.NETWORK

const seed_phrase = process.env.SEED_PHRASE
if (!seed_phrase) {
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

let gas_price
if (process.env.DEFAULT_GAS_PRICE) {
  gas_price = parseInt(process.env.DEFAULT_GAS_PRICE)
} else {
  gas_price = 20e9
}

let gas_limit
if (process.env.DEFAULT_GAS_LIMIT) {
  gas_limit = parseInt(process.env.DEFAULT_GAS_LIMIT)
} else {
  gas_limit = 6721975
}

let force_defaults
if (process.env.FORCE_DEFAULTS) {
  force_defaults = Boolean(process.env.FORCE_DEFAULTS)
} else {
  force_defaults = false
}

console.log("=".repeat(120))
console.log(`${packageData.name} v${packageData.version} (ethers: ${packageData.dependencies.ethers})`)
console.log()

const destinationProvider = new ethers.providers.JsonRpcProvider(
    providerUrl,
    network
)

new WalletMiddlewareServer(
    port,
    seed_phrase,
    destinationProvider,
    gas_price,
    gas_limit,
    force_defaults,
  )
  .initialize()
  .listen()
