import express, { Express } from 'express'
import cors from 'cors'
import { Conflux } from 'js-conflux-sdk'

import { logger, traceKeyValue, zeroPad } from '../Logger'
import { WalletWrapper } from './wrapper'

interface WalletWrapperInfo {
  accumulatedInterestReturn: string,
  address: string, 
  admin: string,
  balance: string,
  codeHash: string,
  collateralForStorage: string,
  nonce: string,  
  stakingBalance: string  
}

/**
 * Leverages `JsonRpcEngine` to intercept account-related calls, and pass any other calls down to a destination
 * provider, e.g. Infura.
 */
export class WalletMiddlewareServer {
  expressServer: Express
  wrapper: WalletWrapper

  dictionaryEthCfx: { [K: string]: string } = {
    eth_blockNumber: "cfx_epochNumber",
    eth_call: "cfx_call",
    eth_estimateGas: "cfx_estimateGasAndCollateral",
    eth_gasPrice: "cfx_gasPrice",
    eth_getBalance: "cfx_getBalance",
    eth_getBlockByHash: "cfx_getBlockByHash",
    eth_getBlockByNumber: "cfx_getBlockByEpochNumber",
    eth_getCode: "cfx_getCode",
    eth_getLogs: "cfx_getLogs",
    eth_getStorageAt: "cfx_getStorageAt",
    eth_getTransactionByHash: "cfx_getTransactionByHash",
    eth_getTransactionCount: "cfx_getNextNonce",
    eth_getTransactionReceipt: "cfx_getTransactionReceipt",
  }

  rpcMethodHandlers: { [K: string]: any }
  rpcParamsHandlers: { [K: string]: any }

  constructor (
    url: string,
    networkId: number,
    privateKey: string,
    defaultGas: BigInt,
    defaultGasPrice: number
  ) {
    this.expressServer = express()

    this.wrapper = new WalletWrapper(
      networkId,
      privateKey,
      defaultGas,
      new Conflux({ url, networkId, defaultGasPrice })
    )

    this.rpcParamsHandlers = {
      eth_getBlockByNumber: this.paramsAppendTrue,
      eth_estimateGas: this.paramsTranslateTag
    }

    this.rpcMethodHandlers = {          
      eth_accounts: this.wrapper.getAccounts,
      cfx_call: this.wrapper.call,
      net_version: this.wrapper.getNetworkId
    }
  
    traceKeyValue("Conflux provider", [
      ["Network id", networkId],
      ["Provider URL", url],
      ["Def. gas limit", defaultGas],
      ["Def. gas price", defaultGasPrice]
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
        }

        let method = request.method

        if (method in this.dictionaryEthCfx) {
          request.method = this.dictionaryEthCfx[request.method]
          logger.log({level: 'info', socket, message: `>> ${method} >> ${request.method}`})
        } else {
          logger.log({level: 'info', socket, message: `>> ${method}`})
        }

        if (method in this.rpcParamsHandlers) {
          request.params = await this.rpcParamsHandlers[method].bind(this)(
            request.params,
            socket
          )
        }
        
        const header = {
          jsonrpc: request.jsonrpc,
          id: request.id
        }

        let response: {id: number, jsonrpc: string, result?: string, error?:string}
        let result
        try {
          if (request.method in this.rpcMethodHandlers) {
            result = await this.rpcMethodHandlers[request.method].bind(this.wrapper)(
              ...(request.params || []),
              socket
            )
          } else {
            result = await this.wrapper.send(
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
              : `{ "error": { "code": -32000, "message" : "${message}"}}`
          )
          body = typeof body !== "string" ? JSON.stringify(body) : body
          try {
            response = { ...header, error: JSON.parse(body).error }
          } catch (e) {
            logger.log({
              level: 'error',
              socket,
              message: `<= Invalid JSON: "${body}"`
            })
            response = { ...header, error: `{ "code": -32700, "message": "Invalid JSON" }`}
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
            level: 'http',
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

    let info
    try {
      info = (await this.wrapper.getAccount(this.wrapper.account.toString())) as WalletWrapperInfo
    } catch (e) {
      console.error("Service provider seems to be down or rejecting connections !!!")
      console.error(e)
      process.exit(-1)
    }

    traceKeyValue("Conflux wallet", [
      ["Address", info.address.toLowerCase()],
      ["Admin  ", info.admin.toLowerCase()],
      ["Balance", info.balance],
      ["Nonce  ", info.nonce]
    ])

    console.log(`Listening on ${hostname || '0.0.0.0'}:${port} [${logger.level.toUpperCase()}]`)
    console.log()    

    this.expressServer.listen(port, hostname || '0.0.0.0')

    return this
  }

  async paramsAppendTrue(params:any[], socket:SocketParams): Promise<any> {
    params = [...params, true]
    logger.log({level: 'verbose', socket, message: `Transforming RPC params: appending 'true'`})
    return this.traceParams(params, socket)
  }

  async paramsTranslateTag(params:any[], socket:SocketParams) {
    if (params.length > 1) {
      let index = params.length - 1
      let tag = params[index]
      switch (tag) {
        case "latest": 
          params[index] = "latest_state"
          break
        case "pending":
          params[index] = "latest_checkpoint"
          break
        case "earliest": 
          break
        default:
          if (!tag.startsWith("0x")) params.pop()
      }
    }
    return this.traceParams(params, socket)
  }

  async traceParams(params:any[], socket:SocketParams) {
    params.forEach((value, index) => {
      logger.log({level: 'debug', socket, message: `> [${index}] => ${JSON.stringify(value)}`})
    })
    return params
  }

}
