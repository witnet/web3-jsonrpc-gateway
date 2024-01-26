#!/usr/bin/env node

import { ethers } from 'ethers'
import { WalletMiddlewareServer } from '../../lib/ethers/server'

require('dotenv').config()
const packageData = require('../../../package.json')

// Mandatory: Listening port for the server. Can also be passed from command-line as first parameter:
let port
if (process.argv.length >= 3) {
  port = parseInt(process.argv[2])
} else if (process.env.W3GW_PORT) {
  port = parseInt(process.env.W3GW_PORT)
} else {
  console.info(
    '\n\x1b[1;37mError: No listening port provided. Please set the \x1b[33mW3GW_PORT\x1b[37m environment variable.\x1b[0m'
  )
  process.exit(0)
}

// Mandatory: The network name to connect with. Can also be passed as second parameter.
// E.g.: `mainnet`, `ropsten`, `rinkeby`, `kovan` and `goerli`.
const network = process.argv[3] || process.env.W3GW_NETWORK
if (!network) {
  console.info(
    '\n\x1b[1;37mError: No network specified. Please set the \x1b[33mW3GW_NETWORK\x1b[37m environment variable.\x1b[0m'
  )
  process.exit(0)
}

// Mandatory: The seed phrase to use for the server's own wrapped wallet, in BIP-39 mnemonics format.
const seed_phrase = process.env.W3GW_SEED_PHRASE || ""
const private_keys = JSON.parse(process.env.W3GW_PRIVATE_KEYS || "")
if (!seed_phrase && !private_keys) {
  console.info(
    '\n\x1b[1;37mError: No mnemonic phrase nor private keys were provided. Please, set either the \x1b[1;33mW3GW_SEED_PHRASE\x1b[37m or the \x1b[33mW3GW_PRIVATE_KEYS\x1b[37m variables, or both.\x1b[0m'
  )
  process.exit(0)
}

// Optional: number of wallet addresses to be handled by the server, derived from path '`m/44'/60'/0'/0/*`'.
let seed_phrase_wallets
if (process.env.W3GW_SEED_PHRASE_WALLETS) {
  seed_phrase_wallets = parseInt(process.env.W3GW_SEED_PHRASE_WALLETS)
} else {
  seed_phrase_wallets = 5
}

// Mandatory: the Infura project ID.
const projectId = process.env.W3GW_PROVIDER_KEY || ''
if (projectId.length < 1) {
  throw Error(
    'No Infura W3GW_PROVIDER_KEY provided. Please set the `W3GW_PROVIDER_KEY` environment variable.'
  )
}

// Optional: Number of blocks before EVM's latest state on which EVM calls will be perfomed
let interleave_blocks = 0
if (process.env.EVM_CALL_INTERLEAVE_BLOCKS) {
  interleave_blocks = parseInt(process.env.EVM_CALL_INTERLEAVE_BLOCKS)
}

// Optional: default gas limit to be used before signing a transaction, if not specified by the caller.
let gas_price = 100e9
if (process.env.INFURA_GAS_PRICE) {
  gas_price = parseInt(process.env.INFURA_GAS_PRICE)
}

// Optional: default gas price to be used before signing a transaction, if not specified by the caller.
let gas_limit = 6721975
if (process.env.INFURA_GAS_LIMIT) {
  gas_limit = parseInt(process.env.INFURA_GAS_LIMIT)
}

// Optional: gas price factor to be applied to when ETHERS_ESTIMATE_GAS_PRICE is true
let gas_price_factor = 1.0
if (process.env.INFURA_GAS_PRICE_FACTOR) {
  gas_price_factor = parseFloat(process.env.INFURA_GAS_PRICE_FACTOR)
}

// Optional: gas limit factor to be applied to when ETHERS_ESTIMATE_GAS_LIMIT is true
let gas_limit_factor = 1.0
if (process.env.INFURA_GAS_LIMIT_FACTOR) {
  gas_limit_factor = parseFloat(process.env.INFURA_GAS_LIMIT_FACTOR)
}

console.log('='.repeat(120))
console.log(
  `${packageData.name} v${packageData.version} (ethers: ${packageData.devDependencies.ethers})`
)
console.log()

const destinationProvider = new ethers.providers.InfuraProvider(
  network,
  projectId
)

new WalletMiddlewareServer(
  seed_phrase,
  seed_phrase_wallets, // number of addresses
  private_keys,
  interleave_blocks,
  gas_price,
  gas_limit,
  true, // estimate gas limit
  true, // estimate gas price
  false, // always synced
  false, // mock filters
  gas_price_factor,
  gas_limit_factor,
  false, // force EIP-155 txs
  false, // force EIP-1559 txs
  false, // eth gas price factor
  destinationProvider,
)
  .initialize()
  .listen(port)
