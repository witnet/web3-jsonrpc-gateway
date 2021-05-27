import { WalletMiddlewareServer } from './walletMiddlewareServer'
import { ethers } from 'ethers'

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
    'No provider URL provided. Please set the `PROJECT_ID` environment variable.'
  )
}

console.log("Port:\t", port)
console.log("Network:", network)
console.log("Project:", projectId)
console.log()

const destinationProvider = new ethers.providers.InfuraProvider(
  network,
  projectId
)

new WalletMiddlewareServer(port, seed_phrase, destinationProvider)
  .initialize()
  .listen()
