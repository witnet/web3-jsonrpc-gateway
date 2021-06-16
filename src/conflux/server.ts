import express, { Express } from 'express'
import cors from 'cors'
import { Conflux, format as confluxFormat, TransactionOption } from 'js-conflux-sdk'

import { logger, SocketParams, traceKeyValue } from '../Logger'
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
      eth_call: this.paramsTranslateTxAndTag,
      eth_estimateGas: this.paramsTranslateTxAndTag,
      eth_getCode: this.paramsTranslateAddrAndTag,
      eth_getBalance: this.paramsTranslateAddrAndTag,
      eth_getBlockByNumber: this.paramsTranslateTag,
      eth_getTransactionCount: this.paramsTranslateAddrAndTag,
      eth_sendTransaction: this.paramsTranslateTxAndTag,
    }

    this.rpcMethodHandlers = {          
      cfx_call: this.wrapper.call,
      cfx_sendTransaction: this.wrapper.processTransaction,
      eth_accounts: this.wrapper.getAccounts,
      eth_sendTransaction: this.wrapper.processTransaction,
      eth_sign: this.wrapper.processEthSignMessage,      
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

        const socket:SocketParams = {
          clientAddr: req.connection.remoteAddress || 'unknownAddr',
          clientPort: req.connection.remotePort || 0,
          clientId: request.id % 10000,
          serverId: parseInt('0x' + this.wrapper.conflux.provider.requestId()) % 10000
        }

        let method = request.method

        if (method in this.dictionaryEthCfx) {
          request.method = this.dictionaryEthCfx[request.method]
          logger.log({level: 'info', socket, message: `>> ${method} >> ${request.method}`})
        } else {
          logger.log({level: 'info', socket, message: `>> ${method}`})
        }
        if (request.params && request.params.length > 0) {
          logger.log({level: 'debug', socket, message: `> ${JSON.stringify(request.params)}`})
        }
        
        const header = {
          jsonrpc: request.jsonrpc,
          id: request.id
        }

        let response: {id: number, jsonrpc: string, result?: string, error?:string}
        let result

        if (method in this.rpcParamsHandlers) {
          request.params = await this.rpcParamsHandlers[method].bind(this)(
            request.params,
            socket
          )
        }

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
              : `{ "error": { "code": ${roger.code || -32600}, "message" : "${JSON.stringify(roger.data ? roger.data : message).replace(/\"/g,"").replace(/\\/g,"/")}" } }`
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
          if (method.startsWith("eth_") && result && typeof result === 'object') {
            result = this.translateCfxAddressesInObject(result, socket)
          }
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

  paramsTranslateAddrAndTag(params:any[], socket:SocketParams) {
    if (params.length > 0) {
      params[0] = this.translateEthAddress(params[0])
      if (params.length > 1 && typeof params[1] === 'string') {
        params[1] = this.translateTag(params[1])
      }
    }
    return this.traceParams(params, socket)
  }

  paramsTranslateTag(params:any[], socket:SocketParams) {
    if (params.length > 0) {
      params[0] = this.translateTag(params[0])
    }
    return this.traceParams(params, socket)
  }

  paramsTranslateTxAndTag(params:any[], socket:SocketParams) {
    if (params.length > 0) {
      if (params[0] && typeof params[0] === 'object') {
        params[0] = this.translateEthAddressesInTransaction(params[0])
      }
      if (params.length > 1 && params[1] && typeof params[1] === 'string') {
        params[1] = this.translateTag(params[1])
      }
    }
    return this.traceParams(params, socket)
  }

  traceParams(params:any[], socket:SocketParams) {
    params.forEach((value, index) => {
      logger.log({level: 'verbose', socket, message: `> [${index}] => ${JSON.stringify(value)}`})
    })
    return params
  }

  translateEthAddress(address:string) {
    try {
      return confluxFormat.address(address, this.wrapper.networkId)
    } catch (e) {
      return confluxFormat.address(this.wrapper.account.toString(), this.wrapper.networkId)
    }
  }

  translateTag(tag:string) {
    switch (tag) {
      case "latest": return "latest_state"; 
      case "pending": return "latest_checkpoint";
      default: return tag
    }
  }

  translateEthAddressesInTransaction(tx:TransactionOption) {
    if (tx.from) tx.from = this.translateEthAddress(tx.from) 
    if (tx.to) tx.to =this.translateEthAddress(tx.to)
    return tx
  }

  translateCfxAddressesInObject(obj:any, socket:SocketParams) {
    const keys = Object.keys(obj)
    keys.forEach((key) => {
      let value = obj[key]
      if (typeof value === 'object' && value !== null) {
        value = this.translateCfxAddressesInObject(value, socket)
      } else if (typeof value === 'string') {
        if (value.toLowerCase().startsWith("cfx")) {
          obj[key] = confluxFormat.hexAddress(value)
          logger.log({level: 'debug', socket, message: `< [${key}]: ${value.toLowerCase()} => ${obj[key]}`})
        }
      }
      switch (key) {
        case "epochNumber":
            obj["number"] = obj[key]
            obj["blockNumber"] = obj[key]
            break
        case "index":
            obj["transactionIndex"] = obj[key]
            break
        case "gasUsed":
            obj["cumulativeGasUsed"] = obj[key]
            break            
        case "contractCreated":
            obj["contractAddress"] = obj[key]
        case "outcomeStatus":
            obj["status"] = obj[key]
            break
        case "stateRoot":
            obj["root"] = obj[key]
            break
        case "status":
        case "outcomeStatus":
          if (obj[key]) {
            if (typeof obj[key] === 'number') {
              obj["status"] = (obj[key] == 0 ? 1 : 0)
            } else if (typeof obj[key] === 'string') {
              if (obj[key] === "0" || obj[key] === "0x0") obj["status"] = "0x1"
              else obj["status"] ="0x0"
            } else {
              obj["status"] = obj[key]
            }
          }
          console.log(`Transalating '${key}' to key 'status' and value ${obj["status"]}`)
          break
        default:
      }
    })
    return obj
  }
}
