import express, { Express } from 'express'
import { WalletWrapper } from './walletWrapper'
import cors from 'cors'
import ethers from 'ethers'

/**
 * Leverages `JsonRpcEngine` to intercept account-related calls, and pass any other calls down to a destination
 * provider, e.g. Infura.
 */
class WalletMiddlewareServer {
  expressServer: Express
  port: number
  wallet: WalletWrapper

  constructor (
    port: number,
    seed_phrase: string,
    provider: ethers.providers.JsonRpcProvider
  ) {
    this.port = port

    this.wallet = new WalletWrapper(seed_phrase, provider)

    this.expressServer = express()

    return this
  }

  /**
   * Initializes the Express server, configures CORS, and passes requests back and forth between the Express server and
   * the `JsonRpcEngine`.
   */
  initialize () {
    this.expressServer.use(cors())
    this.expressServer.use(express.json())

    this.expressServer.post(
      '*',
      async (req: express.Request, res: express.Response) => {
        const request = req.body
        console.log('[<] Request:', request)

        const handlers: { [K: string]: any } = {
          eth_accounts: this.wallet.getAccounts,
          eth_sendTransaction: this.wallet.processTransaction,
          eth_sign: this.wallet.processEthSignMessage
        }

        let result
        if (request.method in handlers) {
          console.log(`Intercepting method: ${request.method}...`)
          result = await handlers[request.method].bind(this.wallet)(
            ...(request.params || [])
          )
        } else {
          console.log(`Forward unhandled method: ${request.method}(${JSON.stringify(request.params)})`)
          result = await this.wallet.provider.send(
            request.method,
            request.params
          )
        }
        const response = {
          jsonrpc: request.jsonrpc,
          id: request.id,
          result
        }

        console.log('[>] Response:', response)
        res.status(200).json(response)
      }
    )

    return this
  }

  /**
   * Tells the Express server to start listening.
   */
  listen (port?: number, hostname?: string) {
    this.expressServer.listen(port || this.port, hostname || '0.0.0.0')

    return this
  }
}

export { WalletMiddlewareServer }
