import {
    Account,
    Conflux,
    EpochNumber,
    Transaction, 
    TransactionOption
  } from 'js-conflux-sdk'

import { logger, SocketParams } from '../Logger'

interface ConfluxStatus {
  bestHash: string,
  chainId: number,
  networkId: number,
  blockNumber: bigint,
  epochNumber: bigint,
  latestCheckpoint: bigint,
  latestConfirmed: bigint,
  latestState: bigint,
  pendingTxNumber: number
}

/**
 * Wraps the Conflux Wallet so it's compatible with the RPC gateway of
 * `web3-jsonrpc-gateway`.
 */

export class WalletWrapper {
  account: Account
  defaultGas: BigInt
  conflux: Conflux
  networkId: number
  
  constructor (
    networkId: number,
    privateKey: string,
    defaultGas: BigInt,
    conflux: Conflux
  ) {
    this.networkId = networkId
    this.defaultGas = defaultGas
    this.conflux = conflux
    this.account = this.conflux.wallet.addPrivateKey(privateKey)
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns 
   */
  async call(
      tx: TransactionOption,
      epoch: EpochNumber,
      socket: SocketParams
    ) : Promise<any>
  {
    if (!epoch) epoch = "latest_state"
    if (!tx.from) tx.from = this.account.toString()
    if (tx.from) logger.verbose({socket, message: `> From: ${tx.from}`})
    if (tx.to) logger.verbose({socket, message: `> To: ${tx.to || '(deploy)'}`})
    if (tx.data) logger.verbose({socket, message: `> Data: ${tx.data ? tx.data.toString().substring(0, 10) + "..." : "(transfer)"}`})
    if (tx.nonce) logger.verbose({socket, message: `> Nonce: ${tx.nonce}`})
    if (tx.value) logger.verbose({socket, message: `> Value: ${tx.value || 0} wei`})
    if (tx.gas) logger.verbose({socket, message: `> Gas: ${tx.gas}`})
    if (tx.gasPrice) logger.verbose({socket, message: `> Gas price: ${tx.gasPrice}`})
    if (tx.storageLimit) logger.verbose({socket, message: `> Storage limit: ${tx.storageLimit}`})
    if (tx.epochHeight) logger.verbose({socket, message: `> Epoch number: ${tx.epochHeight}`})
    if (tx.chainId) logger.verbose({socket, message: `> Chain id: ${tx.chainId}`})

    return this.conflux.call(tx, epoch)
  }

  /**
   * Gets given account's metadata.
   */
  async getAccount(address: string) : Promise<any> {
    return this.conflux.getAccount(address)
  }

  /**
   * Gets addresses of the wallet.
   */
  getAccounts () {
    let accounts:string[] = []
    this.conflux.wallet.forEach((key) => accounts.push(key.address))
    return accounts
  }

  /**
   * Gets tag-specified epoch number.
   */
  async getEpochNumber (tag: EpochNumber) : Promise<any>
  {
    return this.conflux.getEpochNumber(tag)
  }

  /**
   * Gets eth filter changes. Only EthBlockFilters are currently supported.
   */
   async getEthFilterChanges (id: string, socket: SocketParams) : Promise<any>
   {
      logger.verbose({socket, message: `> Filter id: ${id}`})
      if (id === '0x1') {
        return this.conflux.getEpochNumber("latest_state")
      } else {
        const reason = `Unsupported filter ${id}`
        throw {
          reason, body: {
            code: -32500,
            message: reason
          }
        }
      }     
   }

  /**
   * Gets network id.
   */
  async getNetworkId() : Promise<any> {
    return this.networkId
  }

  /**
   * Create new eth_client block filter.
   */
  async createEthBlockFilter(_socket: SocketParams) : Promise<string> {
    return '0x1'
  }

  /**
   * Get syncing status from provider.
   */
  async getSyncingStatus(socket: SocketParams) : Promise<any> {
    try {
      const status:ConfluxStatus = <ConfluxStatus> await this.conflux.getStatus()
      await logger.debug({socket, message: `<<< ${JSON.stringify(status)}`})
      return {
        startingBlock: "0x" + status.latestCheckpoint.toString(16),
        currentBlock: "0x" + status.latestConfirmed.toString(16),
        highestBlock: "0x" + status.epochNumber.toString(16) 
      }
    } catch(_e) {
      return false
    }
  }

  /**
   * Uninstall eth_client filter (mock).
   */
  async uninstallEthFilter(params: TransactionOption, socket: SocketParams) : Promise<boolean> {
    await logger.verbose({socket, message: `> ${params}`})
    return true
  }
  
  /**
   * Signs a message using the wallet's private key.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processEthSignMessage (
      address: string,
      message: object,
      socket: SocketParams
    ): Promise<any>
  {
    console.log(this.getAccounts())
    if (this.getAccounts().includes(address)) {
      logger.verbose({socket, message: `> Signing message "${message}"`})
      let res = await this.account.signMessage(message)
      return res
    } else {
      let reason = `No private key available as to sign messages from '${address}'`
      throw {
        reason,
        body: {
          error: {
            code: -32000,
            message: reason
          }
        }
      }
    }
  }

  /**
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (
      params: TransactionOption,
      socket: SocketParams
    ): Promise<any>
  {
    const gasPrice:BigInt = params.gasPrice || BigInt(this.conflux.defaultGasPrice)
    const nonce:number = parseInt((await this.conflux.getNextNonce(this.account.toString())).toString())
    const epoch:BigInt = BigInt(await this.conflux.getEpochNumber()) + BigInt(50)
    
    // Compose actual transaction:
    let options = {
      from: params.from || this.account.toString(),  
      to: params.to,
      gasPrice: gasPrice.toString(16),
      value: params.value ? params.value.toString(16) : '0x0',
      data: params.data || null,
      nonce: `0x${nonce.toString(16)}`,
      epochHeight: `0x${epoch.toString(16)}`,
      chainId: `0x${this.networkId.toString(16)}`
    }

    // Estimate transacion gas and collateral:
    let estimation:Object 
    try {
      estimation = await this.conflux.estimateGasAndCollateral(options) 
    } catch (e) {
      logger.warn({socket, message: `Cost estimation failed => ${e}`})
      estimation = { storageCollateralized: 0, gasLimit: params.gas }
    }

    logger.verbose({socket, message: `Cost estimation => ${estimation}`})
    
    let payload = {
      ...options,
      storageLimit: to0x(Object(estimation).storageCollateralized),
      gas: to0x(Object(estimation).gasLimit)
    }
    
    // Verbosely log, final transaction params:
    logger.verbose({socket, message: `> From: ${payload.from}`})
    logger.verbose({socket, message: `> To: ${payload.to || '(deploy)'}`})
    logger.verbose({socket, message: `> Data: ${payload.data ? payload.data.toString().substring(0, 10) + "..." : "(transfer)"}`})
    logger.verbose({socket, message: `> Nonce: ${payload.nonce}`})
    logger.verbose({socket, message: `> Value: ${payload.value || "0"} drips`})
    logger.verbose({socket, message: `> Gas: ${payload.gas}`})
    logger.verbose({socket, message: `> Gas price: ${payload.gasPrice}`})
    logger.verbose({socket, message: `> Storage limit: ${payload.storageLimit}`})
    logger.verbose({socket, message: `> Epoch number: ${payload.epochHeight}`})
    logger.verbose({socket, message: `> Chain id: ${payload.chainId}`})
   
    // Sign transaction:
    const tx:Transaction = await this.account.signTransaction(payload)
    
    // Trace signed transaction:
    const serialized = tx.serialize()
    await logger.log({level: 'debug', socket, message: `>>> ${serialized} <<<`})

    // Serialize and send signed transaction:
    return await this.conflux.sendRawTransaction(serialized)
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns 
   */
  async send(method: string, params: any[]) {
    return (params && params.length > 0)
      ? this.conflux.provider.call(method, ...params)
      : this.conflux.provider.call(method)
  }
}

function to0x(value:BigInt) {
  let str = value.toString(16)
  if (!str.startsWith("0x")) str = "0x" + str
  return str
}
