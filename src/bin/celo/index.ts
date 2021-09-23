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
    'No PRIVATE_KEY was provided. Please set the `PRIVATE_KEY` environment variable.'
  )
}

// Optional: ERC20 token address to be used for paying tx gas.
const feeCurrency = process.env.CELO_FEE_CURRENCY

// Optional: gas price factor to be applied to GasPriceMinimum obtained before signing a tx.
let gasLimitFactor = 3
if (process.env.CELO_GAS_LIMIT_FACTOR) {
  gasLimitFactor = parseFloat(process.env.CELO_GAS_LIMIT_FACTOR)
}

// Optional: gas price factor to be applied to GasPriceMinimum obtained before signing a tx.
let gasPriceFactor = 1.3
if (process.env.CELO_GAS_PRICE_FACTOR) {
  gasPriceFactor = parseFloat(process.env.CELO_GAS_PRICE_FACTOR)
}

// Optional: max gas price the gateway is authorized to sign before sending tx to provider.
let maxGasPrice = 10 ** 11 // 100 gwei
if (process.env.CELO_GAS_PRICE_MAX) {
  maxGasPrice = parseInt(process.env.CELO_GAS_PRICE_MAX)
}

console.log("=".repeat(120))
console.log(
  `${packageData.name} v${packageData.version}`,
  `(@celo-tools/celo-ethers-wrapper: ${packageData.dependencies["@celo-tools/celo-ethers-wrapper"]},`,
  `@celo/contractkit: ${packageData.dependencies["@celo/contractkit"]})`
)
console.log()

new WalletMiddlewareServer(
    providerUrl,
    networkId,
    privateKey,
    feeCurrency,
    gasLimitFactor,
    gasPriceFactor,
    maxGasPrice
  )
  .initialize()
  .listen(port)
