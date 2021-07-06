import express, { Express } from 'express'
import cors from 'cors'
import { ethers, Wallet } from 'ethers'

import { logger, traceKeyValue, zeroPad } from '../Logger'
import { WalletWrapper } from './wrapper'

/**
 * Leverages `JsonRpcEngine` to intercept account-related calls, and pass any other calls down to a destination
 * provider, e.g. Infura.
 */
class WalletMiddlewareServer {
  expressServer: Express
  wrapper: WalletWrapper

  constructor (
    seed_phrase: string,
    provider: ethers.providers.JsonRpcProvider,
    gas_price: number,
    gas_limit: number,
    force_defaults: boolean,
    no_addresses: number
  ) {

    this.expressServer = express()
    this.wrapper = new WalletWrapper(seed_phrase, provider, gas_price, gas_limit, force_defaults, no_addresses)
    
    traceKeyValue("Provider", [
      ["Entrypoint", `${provider.connection.url} ${provider.connection.allowGzip ? "(gzip)" : ""}`],
      ["Force defs", force_defaults],
      ["Gas price", gas_price],
      ["Gas limit", gas_limit]
    ])
    
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
          clientAddr: req.connection.remoteAddress,
          clientPort: req.connection.remotePort,
          clientId: request.id,
          serverId: this.wrapper.provider._nextId
        }

        logger.log({
          level: 'info',
          socket,
          message: `>> ${zeroPad(socket.serverId, 4)}::${request.method}`
        })

        const handlers: { [K: string]: any } = {
          eth_accounts: this.wrapper.getAccounts,
          eth_sendTransaction: this.wrapper.processTransaction,
          eth_sign: this.wrapper.processEthSignMessage
        }

        const header = {
          jsonrpc: request.jsonrpc,
          id: request.id
        }

        let response: {id: number, jsonrpc: string, result?: string, error?:string}
        let result
        try {
          if (request.method in handlers) {
            result = await handlers[request.method].bind(this.wrapper)(
              ...(request.params || []),
              socket
            )
          } else {
            result = await this.wrapper.provider.send(
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
  async listen (port: number, hostname?: string) {

    try {
      let network:ethers.providers.Network = await this.wrapper.provider.detectNetwork()
      if (network) {
        traceKeyValue("Network",[
          ["Network id", network.chainId],
          ["Network name", network.name],
          ["ENS address", network.ensAddress]
        ])
      }

      this.wrapper.wallets.forEach(async (wallet:Wallet, index) => {
        traceKeyValue(`Wallet #${index}`, [
          ["Address", await wallet.getAddress()],
          ["Balance", await wallet.getBalance()],
          ["Nonce  ", await wallet.getTransactionCount()]
        ])
      })
    } catch(e) {
      console.error("Service provider seems to be down or rejecting connections !!!")
      console.error(e)
      process.exit(-1)
    }

    traceKeyValue("Listener",[
      ["TCP/host", hostname || '0.0.0.0'],
      ["TCP/port", port],
      ["Log level", logger.level.toUpperCase()]
    ])

    this.expressServer.listen(port, hostname || '0.0.0.0')
    return this
  }
}

export { WalletMiddlewareServer }
