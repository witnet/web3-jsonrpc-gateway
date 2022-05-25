import {
  Account,
  Conflux,
  EpochNumber,
  EPOCH_LABEL,
  Status as ConfluxStatus,
  Transaction,
  TransactionConfig as TransactionOption
} from 'js-conflux-sdk'

import { logger, SocketParams } from '../Logger'

/**
 * Wraps the Conflux Wallet so it's compatible with the RPC gateway of
 * `web3-jsonrpc-gateway`.
 */

export class WalletWrapper {
  accounts: Account[]
  conflux: Conflux  
  defaultGas: BigInt
  epochLabel: EpochNumber
  estimateGasPrice: boolean  
  confirmationEpochs: number
  lastKnownEpochNumber: number
  networkId: number
  
  constructor (
    networkId: number,
    privateKeys: string[],
    confirmationEpochs: number,
    defaultGas: BigInt,
    estimateGasPrice: boolean,
    epochLabel: string,
    conflux: Conflux
  ) {
    this.networkId = networkId
    this.defaultGas = defaultGas
    this.epochLabel = <EPOCH_LABEL>epochLabel
    this.estimateGasPrice = estimateGasPrice    
    this.confirmationEpochs = confirmationEpochs
    this.conflux = conflux
    this.accounts = []
    privateKeys.forEach(privateKey => {
      this.accounts.push(this.conflux.wallet.addPrivateKey(privateKey))
    })
    this.lastKnownEpochNumber = 0
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns
   */
  async call (
    tx: TransactionOption,
    epoch: EpochNumber,
    socket: SocketParams
  ): Promise<any> {
    epoch = await this.checkRollbacks(socket)      
    if (this.confirmationEpochs > 0) {
      epoch = this.lastKnownEpochNumber - this.confirmationEpochs
    }
    logger.verbose({ socket, message: `> Epoch number: ${epoch}` })
    if (!tx.from) tx.from = this.getAccounts()[0]
    if (tx.from) logger.info({ socket, message: `> From: ${tx.from}` })
    if (tx.to)
      logger.info({ socket, message: `> To: ${tx.to || '(deploy)'}` })
    if (tx.data)
      logger.info({
        socket,
        message: `> Data: ${
          tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
        }`
      })
    if (tx.nonce) logger.verbose({ socket, message: `> Nonce: ${tx.nonce}` })
    if (tx.value)
      logger.info({ socket, message: `> Value: ${tx.value || 0} wei` })
    if (tx.gas) logger.verbose({ socket, message: `> Gas: ${tx.gas}` })
    if (tx.gasPrice)
      logger.verbose({ socket, message: `> Gas price: ${tx.gasPrice}` })
    if (tx.storageLimit)
      logger.verbose({ socket, message: `> Storage limit: ${tx.storageLimit}` })
    if (tx.chainId)
      logger.verbose({ socket, message: `> Chain id: ${tx.chainId}` })
    return this.conflux.call(tx, epoch)
  }

  /**
   * Check for possible rollbacks on the EVM side. 
   * @param socket Socket parms where the RPC call is coming from
   * @returns True if a compromising rollback is detected.
   */
  async checkRollbacks(socket: SocketParams): Promise<number> {
    const epoch = await this.conflux.getEpochNumber(this.epochLabel)
    if (epoch < this.lastKnownEpochNumber) {
      if (epoch <= this.lastKnownEpochNumber - this.confirmationEpochs) {
        logger.error({socket, message: `Detected compromising rollback: from epoch ${this.lastKnownEpochNumber} down to ${epoch}`})

      } else {
        logger.warn({socket, message: `Filtered possible rollback: from epoch ${this.lastKnownEpochNumber} down to ${epoch}`})
      }
    }
    this.lastKnownEpochNumber = epoch
    return epoch
  }

  /**
   * Create new eth_client block filter.
   */
  async createEthBlockFilter (_socket: SocketParams): Promise<string> {
    return '0x1'
  }
  
  /**
   * Use Conflux SDK to process `eth_estimateGas`, while making response ETH compliant
   */
   async estimateGas (
    params: TransactionOption,
    _socket: SocketParams
  ): Promise<any> {
    let res: any = await this.conflux.estimateGasAndCollateral(params)
    return res.gasLimit
  }

  /**
   * Gets Account interaction object of given address, if available.
   */
  getAccount (address: string): Account | undefined {
    return this.accounts.find(account => account.toString().toLowerCase() === address.toLowerCase())
  }

  /**
   * Gets account info of given address
   */
  async getAccountInfo (address: string): Promise<any> {
    return this.conflux.getAccount(address)
  }

  /**
   * Gets addresses of the wallet.
   */
  getAccounts () {
    let accounts: string[] = []
    this.conflux.wallet.forEach(key => accounts.push(key.address))
    return accounts
  }

  /**
   * Gets eth filter changes. Only EthBlockFilters are currently supported.
   */
  async getEthFilterChanges (id: string, socket: SocketParams): Promise<any> {
    logger.verbose({ socket, message: `> Filter id: ${id}` })
    if (id === '0x1') {
      return this.conflux.getEpochNumber('latest_state')
    } else {
      const reason = `Unsupported filter ${id}`
      throw {
        reason,
        body: {
          code: -32500,
          message: reason
        }
      }
    }
  }

  /**
   * Gets network id.
   */
  async getNetworkId (): Promise<any> {
    return this.networkId
  }

  /**
   * Get syncing status from provider.
   */
  async getSyncingStatus (socket: SocketParams): Promise<any> {
    try {
      const status: ConfluxStatus = <ConfluxStatus>(
        await this.conflux.getStatus()
      )
      await logger.debug({ socket, message: `<<< ${JSON.stringify(status)}` })
      return {
        startingBlock: '0x' + status.latestCheckpoint.toString(16),
        currentBlock: '0x' + status.latestConfirmed.toString(16),
        highestBlock: '0x' + status.epochNumber.toString(16)
      }
    } catch (_e) {
      return false
    }
  }

  /**
   * Uninstall eth_client filter (mock).
   */
  async uninstallEthFilter (
    params: TransactionOption,
    socket: SocketParams
  ): Promise<boolean> {
    await logger.verbose({ socket, message: `> ${params}` })
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
  ): Promise<any> {
    console.log(this.getAccounts())
    if (this.getAccounts().includes(address)) {
      logger.verbose({ socket, message: `> Signing message "${message}"` })
      return this.getAccount(address)?.signMessage(message)
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
  ): Promise<any> {
    let gasPrice: number | string
    if (this.estimateGasPrice) {
      let gasPriceBI = await this.conflux.getGasPrice()
      if (gasPriceBI > BigInt(this.conflux.defaultGasPrice)) {
        let reason = `Estimated gas price exceeds threshold (${gasPriceBI} > ${this.conflux.defaultGasPrice})`
        throw {
          reason,
          body: {
            error: {
              code: -32099,
              message: reason
            }
          }
        }
      }
      gasPrice = '0x' + BigInt(`${gasPriceBI}0`).toString(16)
    } else {
      gasPrice =
        params.gasPrice ||
        '0x' + BigInt(this.conflux.defaultGasPrice).toString(16)
    }

    if (!params.from) {
      params.from = this.getAccounts()[0]
    }

    const epoch: BigInt = BigInt(await this.conflux.getEpochNumber()) + BigInt(100)
    const nonce: number = parseInt((await this.conflux.getNextNonce(params.from)).toString())

    // Compose actual transaction:
    let options = {
      from: params.from,
      to: params.to,
      gasPrice,
      value: params.value ? params.value.toString(16) : '0x0',
      data: params.data || null,
      nonce: `0x${nonce.toString(16)}`,
      epochHeight: `0x${epoch.toString(16)}`,
      chainId: `0x${this.networkId.toString(16)}`
    }

    // Estimate transacion gas and collateral:
    let estimation: Object
    try {
      estimation = await this.conflux.estimateGasAndCollateral(options)
    } catch (e) {
      logger.warn({ socket, message: `Cost estimation failed => ${e}` })
      estimation = { storageCollateralized: 0, gasLimit: params.gas }
    }

    logger.verbose({
      socket,
      message: `Cost estimation => ${JSON.stringify(estimation)}`
    })

    let payload = {
      ...options,
      storageLimit: to0x(Object(estimation).storageCollateralized),
      gas: to0x(Object(estimation).gasLimit)
    }

    // Verbosely log, final transaction params:
    logger.verbose({ socket, message: `> From: ${payload.from}` })
    logger.verbose({ socket, message: `> To: ${payload.to || '(deploy)'}` })
    logger.verbose({
      socket,
      message: `> Data: ${
        payload.data
          ? payload.data.toString().substring(0, 10) + '...'
          : '(transfer)'
      }`
    })
    logger.verbose({ socket, message: `> Nonce: ${payload.nonce}` })
    logger.verbose({
      socket,
      message: `> Value: ${payload.value || '0'} drips`
    })
    logger.verbose({ socket, message: `> Gas: ${payload.gas}` })
    logger.verbose({ socket, message: `> Gas price: ${payload.gasPrice}` })
    logger.verbose({
      socket,
      message: `> Storage limit: ${payload.storageLimit}`
    })
    logger.verbose({
      socket,
      message: `> Epoch number: ${payload.epochHeight}`
    })
    logger.verbose({ socket, message: `> Chain id: ${payload.chainId}` })

    // Sign transaction:    
    const account: Account | undefined = await this.getAccount(params.from)
    const tx: Transaction | undefined = await account?.signTransaction(payload)
    if (!tx) {
      let reason = `No private key available as to sign messages from '${params.from}'`
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

    // Trace signed transaction:
    const serialized = tx.serialize()
    await logger.log({
      level: 'debug',
      socket,
      message: `>>> ${serialized} <<<`
    })

    // Serialize and send signed transaction:
    return await this.conflux.sendRawTransaction(serialized)
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns
   */
  async send (method: string, params: any[]) {
    return params && params.length > 0
      ? this.conflux.provider.call(method, ...params)
      : this.conflux.provider.call(method)
  }
}

function to0x (value: BigInt) {
  let str = value.toString(16)
  if (!str.startsWith('0x')) str = '0x' + str
  return str
}
