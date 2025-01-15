#!/usr/bin/env node

import { WalletMiddlewareServer } from '../../lib/conflux/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: the actual URL of the Web3 JSON-RPC provider. Can also be passed as first parameter.
const providerUrl = process.argv[2] || process.env.ETHRPC_PROVIDER_URL || ''
if (providerUrl.length < 1) {
  throw Error(
    'No provider URL provided. Please set the `ETHRPC_PROVIDER_URL` environment variable.'
  )
}

// Mandatory: The network id to connect with. Can also be passed as second parameter.
let networkId
if (process.argv.length >= 4) {
  networkId = parseInt(process.argv[3])
} else if (process.env.ETHRPC_NETWORK) {
  networkId = parseInt(process.env.ETHRPC_NETWORK)
} else {
  throw Error(
    'No network id provided. Please set the `ETHRPC_NETWORK` environment variable.'
  )
}

// Mandatory: Listening port for the server. Can also be passed from command-line as third parameter:
let port
if (process.argv.length >= 5) {
  port = parseInt(process.argv[4])
} else if (process.env.ETHRPC_PORT) {
  port = parseInt(process.env.ETHRPC_PORT)
} else {
  throw Error(
    'No listening port provided. Please set the `ETHRPC_PORT` environment variable.'
  )
}

// Mandatory: the private key to use for generation the server's own wrapped wallet.
const privateKeys = JSON.parse(process.env.ETHRPC_PRIVATE_KEYS || '')
if (!privateKeys || privateKeys.length === 0) {
  throw Error(
    'No private keys were provided. Please set the `ETHRPC_PRIVATE_KEYS` environment variable.'
  )
}

// Optional: Number of blocks before EVM's latest state on which EVM calls will be perfomed
let interleaveEpochs = 0
if (process.env.ETHRPC_CALL_INTERLEAVE_BLOCKS) {
  interleaveEpochs = parseInt(process.env.ETHRPC_CALL_INTERLEAVE_BLOCKS)
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let defaultGasPrice
if (process.env.ETHRPC_CONFLUX_GAS_PRICE) {
  defaultGasPrice = parseInt(process.env.ETHRPC_CONFLUX_GAS_PRICE)
} else {
  defaultGasPrice = 1
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let defaultGasLimit: BigInt
if (process.env.ETHRPC_CONFLUX_GAS_LIMIT) {
  defaultGasLimit = BigInt(process.env.ETHRPC_CONFLUX_GAS_LIMIT)
} else {
  defaultGasLimit = BigInt(21000)
}

// Optional: if `true`, let provider estimate gas price before signing the transaction
const estimateGasPrice: boolean = JSON.parse(
  process.env.ETHRPC_CONFLUX_ESTIMATE_GAS_PRICE || 'false'
)

// Optional: Epoch number tag to be used as default value on those RPC methods that may require it.
const epochLabel = process.env.ETHRPC_CONFLUX_DEFAULT_EPOCH_LABEL || 'latest_finalized'

// Optional: if `true`, let provider estimate gas price before signing the transaction
const alwaysSynced: boolean = JSON.parse(
  process.env.ETHRPC_CONFLUX_ALWAYS_SYNCED || 'true'
)

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (js-conflux-sdk: ${packageData.devDependencies['js-conflux-sdk']})`
)
console.log()

new WalletMiddlewareServer(
  providerUrl,
  networkId,
  privateKeys,
  interleaveEpochs,
  defaultGasLimit,
  defaultGasPrice,
  estimateGasPrice,
  epochLabel,
  alwaysSynced
)
  .initialize()
  .listen(port)
