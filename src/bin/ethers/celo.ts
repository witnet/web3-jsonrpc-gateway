#!/usr/bin/env node

import { WalletMiddlewareServer } from '../../celo/server'

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
    'No PRIVATE_KEY was provided. Please set the `PRIVATE_KEY` environment variable.'
  )
}

// Optional: ERC20 token address to be used for paying tx gas.
const feeCurrency = process.env.CELO_FEE_CURRENCY

console.log("=".repeat(120))
console.log(`${packageData.name} v${packageData.version} (@celo-tools/celo-ethers-wrapper: ${packageData.dependencies["@celo-tools/celo-ethers-wrapper"]})`)
console.log()

new WalletMiddlewareServer(
    providerUrl,
    networkId,
    privateKey,
    feeCurrency
  )
  .initialize()
  .listen(port)
