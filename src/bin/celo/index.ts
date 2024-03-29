#!/usr/bin/env node

import { WalletMiddlewareServer } from '../../lib/celo/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: the actual URL of the Web3 JSON-RPC provider. Can also be passed as first parameter.
const providerUrl = process.argv[2] || process.env.W3GW_PROVIDER_URL || ''
if (providerUrl.length < 1) {
  throw Error(
    'No provider URL provided. Please set the `W3GW_PROVIDER_URL` environment variable.'
  )
}

// Mandatory: The network id to connect with. Can also be passed as second parameter.
let networkId
if (process.argv.length >= 4) {
  networkId = parseInt(process.argv[3])
} else if (process.env.W3GW_NETWORK) {
  networkId = parseInt(process.env.W3GW_NETWORK)
} else {
  throw Error(
    'No network id provided. Please set the `W3GW_NETWORK` environment variable.'
  )
}

// Mandatory: Listening port for the server. Can also be passed from command-line as third parameter:
let port
if (process.argv.length >= 5) {
  port = parseInt(process.argv[4])
} else if (process.env.W3GW_PORT) {
  port = parseInt(process.env.W3GW_PORT)
} else {
  throw Error(
    'No listening port provided. Please set the `W3GW_PORT` environment variable.'
  )
}

// Mandatory: the private key to use for generation the server's own wrapped wallet.
const privateKeys = JSON.parse(process.env.W3GW_PRIVATE_KEYS || '')
if (!privateKeys || privateKeys.length == 0) {
  throw Error(
    'No private keys were provided. Please set the `W3GW_PRIVATE_KEYS` environment variable.'
  )
}

// Optional: Number of blocks before EVM's latest state on which EVM calls will be perfomed
let interleaveBlocks = 0
if (process.env.EVM_CALL_INTERLEAVE_BLOCKS) {
  interleaveBlocks = parseInt(process.env.EVM_CALL_INTERLEAVE_BLOCKS)
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

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version}`,
  `(@celo-tools/celo-ethers-wrapper: ${packageData.devDependencies['@celo-tools/celo-ethers-wrapper']},`,
  `@celo/contractkit: ${packageData.devDependencies['@celo/contractkit']})`
)
console.log()

new WalletMiddlewareServer(
  providerUrl,
  networkId,
  privateKeys,
  interleaveBlocks,
  feeCurrency,
  gasLimitFactor,
  gasPriceFactor,
  maxGasPrice
)
  .initialize()
  .listen(port)
