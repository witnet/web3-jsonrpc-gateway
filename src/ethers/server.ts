import express, { Express } from 'express'
import cors from 'cors'
import ethers from 'ethers'

import { logger, traceKeyValue, zeroPad } from '../Logger'
import { WalletWrapper } from './wrapper'

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
    provider: ethers.providers.JsonRpcProvider,
    gas_price: number,
    gas_limit: number
    
  ) {
    this.expressServer = express()
    this.port = port
    this.wallet = new WalletWrapper(seed_phrase, provider, gas_price, gas_limit)

    traceKeyValue("Network", [
      ["Chain id", provider.network.chainId],
      ["Known as", provider.network.name],
      ["ENS addr", provider.network.ensAddress]
    ])
    
    traceKeyValue("Provider", [
      [null, `${provider.connection.url} ${provider.connection.allowGzip ? "(gzip)" : ""}`]
    ])
    
    traceKeyValue("Default gas price", [[null, gas_price]])
    traceKeyValue("Default gas limit", [[null, gas_limit]])

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
        const socket = {
          addr: req.connection.remoteAddress,
          port: req.connection.remotePort,
          clientId: request.id,
          serverId: this.wallet.provider._nextId
        }

        logger.log({
          level: 'info',
          socket,
          message: `>> ${zeroPad(socket.serverId, 4)}::${request.method}`
        })

        const handlers: { [K: string]: any } = {
          eth_accounts: this.wallet.getAccounts,
          eth_sendTransaction: this.wallet.processTransaction,
          eth_sign: this.wallet.processEthSignMessage
        }

        const header = {
          jsonrpc: request.jsonrpc,
          id: request.id
        }

        let response: {id: number, jsonrpc: string, result?: string, error?:string}
        let result
        try {
          if (request.method in handlers) {
            result = await handlers[request.method].bind(this.wallet)(
              ...(request.params || []),
              socket
            )
          } else {
            result = await this.wallet.provider.send(
              request.method,
              request.params
            )
          }
          response = { ...header, result }
        } catch (roger) {
          const message = roger.reason || (roger.error && roger.error.reason) || roger || "null exception"
          let body = roger.body || (
            (roger.error && roger.error.body)
              ? roger.error.body
              : `{ "error": { "code": -32000, "message" : "${message.replace("\"", "'")}"}}`
          )
          body = typeof body !== "string" ? JSON.stringify(body) : body
          try {
            response = { ...header, error: JSON.parse(body).error }
          } catch (e) {
            logger.log({
              level: 'error',
              socket,
              message: `<= ${zeroPad(socket.serverId, 4)}::Invalid JSON: ${body}`
            })
            response = { ...header, error: `{ "code": -32700, "message": "Invalid JSON" }`}
          }
        }
        if (response.error) {
          logger.log({
            level: 'warn',
            socket,
            message: `<= ${zeroPad(socket.serverId, 4)}::Error: ${JSON.stringify(response.error)}`
          })
        } else {
          logger.log({
            level: 'debug',
            socket,
            message: `<< ${zeroPad(socket.serverId, 4)}::${JSON.stringify(result)}`
          })
        }
        res.status(200).json(response)
      }
    )
    return this
  }

  /**
   * Tells the Express server to start listening.
   */
  async listen (port?: number, hostname?: string) {
    this.expressServer.listen(port || this.port, hostname || '0.0.0.0')
    traceKeyValue("Address", [[null, await this.wallet.wallet.getAddress()],])
    console.log(`Listening on ${hostname || '0.0.0.0'}:${port || this.port}`)
    console.log()
    return this
  }
}

export { WalletMiddlewareServer }
