import express, { Express } from 'express'
import {
  JsonRpcEngine,
  JsonRpcMiddleware,
  JsonRpcRequest
} from 'json-rpc-engine'
import { createWalletMiddleware } from 'eth-json-rpc-middleware'
import { WalletWrapper } from './walletWrapper'
import cors from 'cors'

/**
 * Leverages `JsonRpcEngine` to intercept account-related calls, and pass any other calls down to a destination
 * provider, e.g. Infura.
 */
class WalletMiddlewareServer {
  expressServer: Express
  jsonRpcEngine: JsonRpcEngine
  port: number
  wallet: WalletWrapper

  constructor (
    port: number,
    seed_phrase: string,
    destinationProvider: JsonRpcMiddleware<any, any>
  ) {
    this.port = port

    this.wallet = new WalletWrapper(seed_phrase)

    this.expressServer = express()

    this.jsonRpcEngine = new JsonRpcEngine()
    this.jsonRpcEngine.push(
      createWalletMiddleware({
        getAccounts: WalletWrapper.prototype.getAccounts.bind(this.wallet),
        processEthSignMessage: WalletWrapper.prototype.processEthSignMessage.bind(
          this.wallet
        )
      })
    )
    this.jsonRpcEngine.push(destinationProvider)

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
        console.log('[<] Request', request)

        const response = await this.jsonRpcEngine.handle(
          (request as unknown) as JsonRpcRequest<any>
        )
        console.log('[>] Response', response)

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
