#!/usr/bin/env node

import { ethers } from 'ethers'
import { WalletMiddlewareServer } from '../walletMiddlewareServer'

require('dotenv').config()
const packageData = require('../../package.json')

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
if (!network) {
  throw Error(
    'No network specified. Please set the `NETWORK` environment variable.'
  )
}

const seed_phrase = process.env.SEED_PHRASE
if (!seed_phrase) {
  throw Error(
    'No mnemonic phrase provided. Please set the `SEED_PHRASE` environment variable.'
  )
}

const projectId = process.env.PROJECT_ID || ''
if (projectId.length < 1) {
  throw Error(
    'No Infura PROJECT_ID provided. Please set the `PROJECT_ID` environment variable.'
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

console.log("=".repeat(120))
console.log(`${packageData.name} v${packageData.version} (ethers: ${packageData.dependencies.ethers})`)
console.log()

const destinationProvider = new ethers.providers.InfuraProvider(
  network,
  projectId
)

new WalletMiddlewareServer(
    port,
    seed_phrase,
    destinationProvider,
    gas_price,
    gas_limit
  )
  .initialize()
  .listen()
