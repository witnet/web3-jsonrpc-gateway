import { WalletMiddlewareServer } from './walletMiddlewareServer'
import createInfuraMiddleware from 'eth-json-rpc-infura'

let port
if (process.env.PORT) {
  port = parseInt(process.env.PORT)
} else {
  throw Error(
    'No listening port provided. Please set the `PORT` environment variable.'
  )
}

const network = process.env.NETWORK
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

const destinationProvider = createInfuraMiddleware({
  network,
  projectId
})

new WalletMiddlewareServer(port, seed_phrase, destinationProvider)
  .initialize()
  .listen()
