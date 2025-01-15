#!/usr/bin/env node

import { ethers } from 'ethers'
import { WalletMiddlewareServer } from '../../lib/ethers/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: the actual URL of the Web3 JSON-RPC provider. Can also be passed as first parameter.
const providerUrl = process.argv[2] || process.env.ETHRPC_PROVIDER_URL || ''
if (providerUrl.length < 1) {
  console.info(
    '\n\x1b[1;37mError: No provider URL was specified. Please set the \x1b[33mETHRPC_PROVIDER_URL\x1b[33m environment variable.\x1b[0m'
  )
  process.exit(0)
}

// Mandatory: Listening port for the server. Can also be passed from command-line as second parameter:
let port
if (process.argv.length >= 4) {
  port = parseInt(process.argv[3])
} else if (process.env.ETHRPC_PORT) {
  port = parseInt(process.env.ETHRPC_PORT)
} else {
  console.info(
    '\n\x1b[1;37mError: No listening port provided. Please set the \x1b[33mETHRPC_PORT\x1b[37m environment variable.\x1b[0m'
  )
  process.exit(0)
}

// Mandatory: The seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
const seed_phrase = process.env.ETHRPC_SEED_PHRASE || ''
const private_keys = JSON.parse(process.env.ETHRPC_PRIVATE_KEYS || '[]')
if (
  seed_phrase === '' &&
  (!Array.isArray(private_keys) || private_keys.length == 0)
) {
  console.info(
    '\n\x1b[1;37mError: No mnemonic phrase nor private keys were provided. Please, set either the \x1b[1;33mETHRPC_SEED_PHRASE\x1b[37m or the \x1b[33mETHRPC_PRIVATE_KEYS\x1b[37m variables, or both.\x1b[0m'
  )
  process.exit(0)
}

// Optional: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.
let seed_phrase_wallets
if (process.env.ETHRPC_SEED_PHRASE_WALLETS) {
  seed_phrase_wallets = parseInt(process.env.ETHRPC_SEED_PHRASE_WALLETS)
} else {
  seed_phrase_wallets = 5
}

// Optional: The network name to connect with. Can also be passed as third parameter.
const network = process.argv[4] || process.env.ETHRPC_NETWORK

// Optional: Number of blocks before EVM's latest state on which EVM calls will be perfomed
let interleave_blocks = 0
if (process.env.ETHRPC_CALL_INTERLEAVE_BLOCKS) {
  interleave_blocks = parseInt(process.env.ETHRPC_CALL_INTERLEAVE_BLOCKS)
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let gas_price = 20e9
if (process.env.ETHRPC_ETHERS_GAS_PRICE) {
  gas_price = parseInt(process.env.ETHRPC_ETHERS_GAS_PRICE)
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let gas_limit = 6721975
if (process.env.ETHRPC_ETHERS_GAS_LIMIT) {
  gas_limit = parseInt(process.env.ETHRPC_ETHERS_GAS_LIMIT)
}

// Optional: if `true`, let provider estimate gas limit before signing the transaction
let estimate_gas_limit: boolean = false
if (process.env.ETHRPC_ETHERS_ESTIMATE_GAS_LIMIT) {
  estimate_gas_limit = JSON.parse(process.env.ETHRPC_ETHERS_ESTIMATE_GAS_LIMIT)
}

// Optional: if `true`, let provider estimate gas price before signing the transaction
let estimate_gas_price: boolean = false
if (process.env.ETHRPC_ETHERS_ESTIMATE_GAS_PRICE) {
  estimate_gas_price = JSON.parse(process.env.ETHRPC_ETHERS_ESTIMATE_GAS_PRICE)
}

// Optional: if `true`, force responses to `eth_syncing` as being always `false`
let always_synced: boolean = false
if (process.env.ETHRPC_ETHERS_ALWAYS_SYNCED) {
  always_synced = JSON.parse(process.env.ETHRPC_ETHERS_ALWAYS_SYNCED)
}

// Optional: if `true`, force responses to `eth_getFilterChanges` to always reply w/ latest block hash
let mock_filters: boolean = false
if (process.env.ETHRPC_ETHERS_MOCK_FILTERS) {
  mock_filters = JSON.parse(process.env.ETHRPC_ETHERS_MOCK_FILTERS)
}

// Optional: gas price factor to be applied to transactions
// with no gas price specified when ETHRPC_ETHERS_ESTIMATE_GAS_PRICE is true
let gas_price_factor = 1.0
if (process.env.ETHRPC_ETHERS_GAS_PRICE_FACTOR) {
  gas_price_factor = parseFloat(process.env.ETHRPC_ETHERS_GAS_PRICE_FACTOR)
}

// Optional: gas limit factor to be applied to transactions
// with no gas limit specified when ETHRPC_ETHERS_ESTIMATE_GAS_LIMIT is true
let gas_limit_factor = 1.0
if (process.env.ETHRPC_ETHERS_GAS_LIMIT_FACTOR) {
  gas_limit_factor = parseFloat(process.env.ETHRPC_ETHERS_GAS_LIMIT_FACTOR)
}

// Optional: force EIP-155 replay-protected transactions
let force_eip_155: boolean = false
if (process.env.ETHRPC_ETHERS_FORCE_EIP_155) {
  force_eip_155 = JSON.parse(process.env.ETHRPC_ETHERS_FORCE_EIP_155)
}

// Optional: force EIP-1559's type 2 transactions
let force_eip_1559: boolean = false
if (process.env.ETHRPC_ETHERS_FORCE_EIP_1559) {
  force_eip_1559 = JSON.parse(process.env.ETHRPC_ETHERS_FORCE_EIP_1559)
}

// Optional: if true, will apply ETHRPC_ETHERS_GAS_PRICE_FACTOR to eth_gasPrice calls
let eth_gas_price_factor: boolean = gas_price_factor > 1.0
if (process.env.ETHRPC_ETHERS_ETH_GAS_PRICE_FACTOR) {
  eth_gas_price_factor = JSON.parse(process.env.ETHRPC_ETHERS_ETH_GAS_PRICE_FACTOR)
}

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (ethers: ${packageData.dependencies.ethers})`
)
console.log()

const destinationProvider = new ethers.providers.StaticJsonRpcProvider(
  providerUrl,
  network
)

new WalletMiddlewareServer(
  seed_phrase,
  seed_phrase_wallets,
  private_keys,
  interleave_blocks,
  gas_price,
  gas_limit,
  estimate_gas_limit,
  estimate_gas_price,
  always_synced,
  mock_filters,
  gas_price_factor,
  gas_limit_factor,
  force_eip_155,
  force_eip_1559,
  eth_gas_price_factor,
  destinationProvider
)
  .initialize()
  .listen(port)
