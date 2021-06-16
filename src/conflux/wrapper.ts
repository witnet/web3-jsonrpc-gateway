import {
    Account,
    Conflux,
    EpochNumber,
    Transaction, 
    TransactionOption
  } from 'js-conflux-sdk'

import { logger, SocketParams } from '../Logger'

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
    if (tx.from)  await logger.log({level: 'verbose', socket, message: `> From: ${tx.from}`})
    if (tx.to)    await logger.log({level: 'verbose', socket, message: `> To: ${tx.to || '(deploy)'}`})
    if (tx.data)  await logger.log({level: 'verbose', socket, message: `> Data: ${tx.data ? tx.data.toString().substring(0, 10) + "..." : "(transfer)"}`})
    if (tx.nonce) await logger.log({level: 'verbose', socket, message: `> Nonce: ${tx.nonce}`})
    if (tx.value) await logger.log({level: 'verbose', socket, message: `> Value: ${tx.value || 0} wei`})
    if (tx.gas)   await logger.log({level: 'verbose', socket, message: `> Gas: ${tx.gas}`})
    if (tx.gasPrice) await logger.log({level: 'verbose', socket, message: `> Gas price: ${tx.gasPrice}`})
    if (tx.storageLimit) await logger.log({level: 'verbose', socket, message: `> Storage limit: ${tx.storageLimit}`})
    if (tx.epochHeight) await logger.log({level: 'verbose', socket, message: `> Epoch number: ${tx.epochHeight}`})
    if (tx.chainId) await logger.log({level: 'verbose', socket, message: `> Chain id: ${tx.chainId}`})

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
      _address: string,
      _message: string,
      _socket: SocketParams
    ): Promise<any>
  {
    // logger.log({
    //   level: 'debug',
    //   socket,
    //   message: `=> Signing message: ${account} ${message}`
    // })
    // return this.wallet.signMessage(message)
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
      value: (params.value || BigInt(0)).toString(16),
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
      logger.warn({socket, message: `Estimation failed: ${e}`})
      estimation = { storageCollateralized: 0, gasLimit: params.gas }
    }

    let payload = {
      ...options,
      storageLimit: to0x(Object(estimation).storageCollateralized),
      gas: to0x(Object(estimation).gasLimit)
    }
    
    // Verbosely log, final transaction params:
    logger.log({level: 'verbose', socket, message: `> From: ${payload.from}`})
    logger.log({level: 'verbose', socket, message: `> To: ${payload.to || '(deploy)'}`})
    logger.log({level: 'verbose', socket, message: `> Data: ${payload.data ? payload.data.toString().substring(0, 10) + "..." : "(transfer)"}`})
    logger.log({level: 'verbose', socket, message: `> Nonce: ${payload.nonce}`})
    logger.log({level: 'verbose', socket, message: `> Value: ${payload.value || "0"} drips`})
    logger.log({level: 'verbose', socket, message: `> Gas: ${payload.gas}`})
    logger.log({level: 'verbose', socket, message: `> Gas price: ${payload.gasPrice}`})
    logger.log({level: 'verbose', socket, message: `> Storage limit: ${payload.storageLimit}`})
    logger.log({level: 'verbose', socket, message: `> Epoch number: ${payload.epochHeight}`})
    logger.log({level: 'verbose', socket, message: `> Chain id: ${payload.chainId}`})
   
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
