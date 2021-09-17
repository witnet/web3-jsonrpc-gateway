import express, { Express } from 'express'
import cors from 'cors'
import { logger, SocketParams, traceKeyValue, zeroPad } from '../Logger'
import { WalletWrapper } from './wrapper'
import { CeloContract } from '@celo/contractkit'

/**
 * Leverages `JsonRpcEngine` to intercept account-related calls, and pass any other calls down to a destination
 * provider, e.g. Infura.
 */
export class WalletMiddlewareServer {
  expressServer: Express
  wrapper: WalletWrapper

  constructor (
    url: string,
    networkId: number,
    privateKey: string,
    feeCurrency: string | undefined,
    gasLimitFactor: number,
    gasPriceFactor: number,
    maxPrice: number
  ) {
    this.expressServer = express()
    this.wrapper = new WalletWrapper(
      url,
      networkId,
      privateKey,
      feeCurrency,
      gasLimitFactor,
      gasPriceFactor,
      maxPrice
    )
    traceKeyValue("Celo provider", [
      ["Network id", networkId],
      ["Provider URL", `${this.wrapper.provider.connection.url} ${this.wrapper.provider.connection.allowGzip ? "(gzip)" : ""}`],
      ["Fee currency", feeCurrency || "(not set)"],
      ["Gas factor", gasLimitFactor],
      ["Price factor", gasPriceFactor],
      ["Max price", `${maxPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} weis / g.u.`]
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

        const socket:SocketParams = {
          clientAddr: req.connection.remoteAddress || 'unknownAddr',
          clientPort: req.connection.remotePort || 0,
          clientId: request.id,
          serverId: this.wrapper.provider._nextId
        }

        logger.log({
          level: 'info',
          socket,
          message: `>> ${request.method}`
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
        } catch (exception) {
          if (!exception.code) {
            // if no error code is specified, 
            //   assume the Conflux provider is actually reporting an execution error:
            exception = {
              reason: exception.toString(),
              body: {
                error: {
                  code: -32015,
                  message: exception.data ? "Execution error" : JSON.stringify(exception),
                  data: exception.data
                }
              }
            }
          }
          const message = exception.reason || (exception.error && exception.error.reason) || exception || "null exception"
          let body = exception.body || (
            (exception.error && exception.error.body)
              ? exception.error.body
              : { error: { code : exception.code || -32099, message: `"${message}"`, data: exception.data } }
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
            response = { ...header, error: `{ "code": -32700, "message": "Invalid JSON response" }`}
          }
        }
        if (response.error) {
          logger.log({
            level: 'warn',
            socket,
            message: `<= Error: ${JSON.stringify(response.error)}`
          })
        } else {
          logger.log({
            level: 'debug',
            socket,
            message: `<< ${JSON.stringify(result)}`
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
      await this.wrapper.provider.ready
    } catch(e) {
      console.error("Service provider seems to be down or rejecting connections !!!")
      console.error(e)
      process.exit(-1)
    }
    traceKeyValue("Celo contracts", [
      ["GsPriceMinimum", await this.wrapper.kit.registry.addressFor(CeloContract.GasPriceMinimum)],
      ["GoldToken", await this.wrapper.kit.registry.addressFor(CeloContract.GoldToken)],
      ["StableToken", await this.wrapper.kit.registry.addressFor(CeloContract.StableToken)],
      ["StableTokenEUR", await this.wrapper.kit.registry.addressFor(CeloContract.StableTokenEUR)],
    ])
    const balance:any = await this.wrapper.wallet.getBalance()
    const decimals:number = await (await this.wrapper.kit.contracts.getGoldToken()).decimals()
    traceKeyValue("Celo wallet", [
      ["Address", await this.wrapper.wallet.getAddress()],
      ["Balance", `${balance / 10 ** decimals} CELO`],
      ["Chainid", await this.wrapper.wallet.getChainId()],
      ["Nonce  ", await this.wrapper.wallet.getTransactionCount()],
    ])
    console.log(`Listening on ${hostname || '0.0.0.0'}:${port} [${logger.level.toUpperCase()}]\n`)
    this.expressServer.listen(port, hostname || '0.0.0.0')
    return this
  }
}
