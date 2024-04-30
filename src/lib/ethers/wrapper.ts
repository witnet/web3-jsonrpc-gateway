import { ethers, BigNumber, Wallet } from 'ethers'
import { logger, SocketParams } from '../Logger'

interface TransactionParams {
  from?: string
  to: string
  gas?: string
  gasPrice?: string
  value?: string
  data: string
  nonce?: string
  type?: number
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {
  chainId: number
  defaultGasPrice!: number
  defaultGasLimit!: number
  estimateGasLimit: boolean
  estimateGasPrice: boolean
  ethGasPriceFactor: boolean
  forceEIP155: boolean
  forceType2Txs: boolean
  gasPriceFactor!: number
  gasLimitFactor!: number
  interleaveBlocks: number
  lastKnownBlock: number
  provider: ethers.providers.JsonRpcProvider
  wallets: Wallet[]

  constructor (
    interleave_blocks: number,
    gas_price: number,
    gas_limit: number,
    estimate_gas_limit: boolean,
    estimate_gas_price: boolean,
    gas_price_factor: number,
    gas_limit_factor: number,
    force_eip_155: boolean,
    force_eip_1559: boolean,
    eth_gas_price_factor: boolean
  ) {
    this.defaultGasPrice = gas_price
    this.defaultGasLimit = gas_limit
    this.estimateGasLimit = estimate_gas_limit
    this.estimateGasPrice = estimate_gas_price
    this.ethGasPriceFactor = eth_gas_price_factor
    this.forceEIP155 = force_eip_155
    this.forceType2Txs = force_eip_1559
    this.gasPriceFactor = gas_price_factor
    this.gasLimitFactor = gas_limit_factor
    this.interleaveBlocks = interleave_blocks
    this.lastKnownBlock = 0
    this.wallets = []
  }

  /**
   * Populate essential transaction parameters, self-estimating gas price and/or gas limit if required.
   * @param socket Socket parms where the RPC call is coming from.
   * @param params Input params, to be validated and completed, if necessary.
   * @returns
   */
  async composeTransaction (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<ethers.providers.TransactionRequest> {
    // Compose actual transaction:
    let tx: ethers.providers.TransactionRequest = {
      from: params.from,
      to: params.to,
      value: params.value,
      data: params.data,
      nonce: params.nonce
    }
    if (this.forceEIP155) {
      tx = {
        ...tx,
        chainId: this.provider.network.chainId
      }
    }
    if (tx.from) {
      logger.verbose({ socket, message: `> From:      ${tx.from}` })
    }
    logger.verbose({ socket, message: `> To:        ${tx.to || '(deploy)'}` })
    logger.verbose({
      socket,
      message: `> Data:      ${
        tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
      }`
    })
    logger.verbose({ socket, message: `> Value:     ${tx.value || 0} wei` })
    if (this.forceEIP155) {
      logger.verbose({ socket, message: `> ChainId:   ${tx.chainId}` })
    }

    // Complete tx type, if necessary:
    if (this.forceType2Txs) {
      tx.type = 2
    }
    if (tx.type) {
      logger.verbose({ socket, message: `> Type:      ${tx.type}` })
    }

    // Complete tx gas price, if necessary:
    if (params.from && !params.gasPrice) {
      tx.gasPrice = (await this.getGasPrice()).toHexString()
    } else if (params.gasPrice) {
      tx.gasPrice = params.gasPrice
      if (
        BigNumber.from(tx.gasPrice).gt(BigNumber.from(this.defaultGasPrice))
      ) {
        const reason = `Provided gas price exceeds threshold (${tx.gasPrice} > ${this.defaultGasPrice})`
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
    }
    if (tx.gasPrice) {
      logger.verbose({ socket, message: `> Gas price: ${tx.gasPrice}` })
    }

    // Complete tx gas limit, if necessary:
    if (params.from && !params.gas) {
      tx.gasLimit = (await this.getGasLimit(tx)).toHexString()
    } else if (params.gas) {
      tx.gasLimit = params.gas
      if (
        BigNumber.from(tx.gasLimit).gt(BigNumber.from(this.defaultGasLimit))
      ) {
        const reason = `Provided gas limit exceeds threshold (${tx.gasLimit} > ${this.defaultGasLimit})`
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
    }
    if (tx.gasLimit) {
      logger.verbose({ socket, message: `> Gas limit: ${tx.gasLimit}` })
    }

    // Complete tx maxFeePerGas, if necessary:
    if (params.maxFeePerGas) {
      tx.maxFeePerGas = params.maxFeePerGas
    } else if (this.forceType2Txs) {
      tx.maxFeePerGas = tx.gasPrice
    }
    if (tx.maxFeePerGas) {
      logger.verbose({
        socket,
        message: `> Max fee per gas: ${tx.maxFeePerGas}`
      })
    }

    // Complete tx maxPriorityFeePerGas, if necesarry:
    if (params.maxPriorityFeePerGas) {
      tx.maxPriorityFeePerGas = params.maxPriorityFeePerGas
    } else if (this.forceType2Txs) {
      tx.maxPriorityFeePerGas = tx.gasPrice
    }
    if (tx.maxPriorityFeePerGas) {
      logger.verbose({
        socket,
        message: `> Max priority fee per gas: ${tx.maxPriorityFeePerGas}`
      })
    }

    // Return tx object
    return tx
  }

  /**
   * Check for possible rollbacks on the EVM side.
   * @param socket Socket parms where the RPC call is coming from
   * @returns Last known block number.
   */
  async checkRollbacks (socket: SocketParams): Promise<number> {
    const block = await this.provider.getBlockNumber()
    if (block < this.lastKnownBlock) {
      if (block <= this.lastKnownBlock - this.interleaveBlocks) {
        logger.warn({
          socket,
          message: `Threatening rollback: from epoch ${this.lastKnownBlock} down to ${block}`
        })
      } else {
        logger.warn({
          socket,
          message: `Harmelss rollback: from epoch ${this.lastKnownBlock} down to ${block}`
        })
      }
    }
    this.lastKnownBlock = block
    return block
  }

  /**
   * Gets addresses of all managed wallets.
   */
  async getAccounts (): Promise<string[]> {
    let accounts: string[] = []
    for (const index in this.wallets) {
      accounts.push(await this.wallets[index].getAddress())
    }
    return accounts
  }

  /**
   * Get block by number. Bypass eventual exceptions.
   */
  async getBlockByNumber (socket: SocketParams, params: string) {
    let res
    try {
      res = await this.provider.getBlock(params)
      if (res) {
        if (res.baseFeePerGas) {
          res = { ...res, baseFeePerGas: res.baseFeePerGas.toHexString() }
        }
        if (res._difficulty) {
          res = { ...res, _difficulty: res._difficulty.toHexString() }
        }
        if (this.estimateGasLimit) {
          // use configured max gas limit as block max gas limit
          res = { ...res, gasLimit: this.defaultGasLimit }
        } else if (res.gasLimit) {
          res = { ...res, gasLimit: res.gasLimit.toHexString() }
        }
        if (res.gasUsed) {
          res = { ...res, gasUsed: res.gasUsed.toHexString() }
        }
      }
    } catch (e) {
      logger.warn({ socket, message: `> Exception bypass: ${e}` })
    }
    return res
  }

  /**
   * Calculates suitable gas price depending on tx params, and gateway settings.
   *
   * @param params Transaction params
   * @returns Estimated gas price, as BigNumber
   */
  async getGasPrice (): Promise<BigNumber> {
    let gasPrice: BigNumber
    if (this.estimateGasPrice) {
      try {
        const factor: number = Math.ceil(this.gasPriceFactor * 100)
        gasPrice = BigNumber.from(await this.provider.getGasPrice())
        gasPrice = gasPrice.mul(factor).div(100)
      } catch (ex) {
        const reason = `Unpredictable gas price: ${ex}`
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
      const gasPriceThreshold = BigNumber.from(this.defaultGasPrice)
      if (gasPrice.gt(gasPriceThreshold)) {
        let reason = `Estimated gas price exceeds threshold (${gasPrice} > ${gasPriceThreshold})`
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
    } else {
      gasPrice = BigNumber.from(this.defaultGasPrice)
    }
    return gasPrice
  }

  /**
   * Calculates suitable gas limit depending on tx params, and gateway settings.
   *
   * @param params Transaction params
   * @returns Estimated gas limit, as BigNumber
   */
  async getGasLimit (
    tx: ethers.providers.TransactionRequest
  ): Promise<BigNumber> {
    let gasLimit: BigNumber
    if (this.estimateGasLimit) {
      try {
        const factor: number = Math.ceil(this.gasLimitFactor * 100)
        gasLimit = await this.provider.estimateGas(tx)
        gasLimit = gasLimit.mul(factor).div(100)
      } catch (ex) {
        const reason = `Unpredictable gas limit: ${ex}`
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
      const gasLimitThreshold: BigNumber = BigNumber.from(this.defaultGasLimit)
      if (gasLimit.gt(gasLimitThreshold)) {
        const reason = `Estimated gas limit exceeds threshold (${gasLimit} > ${gasLimitThreshold})`
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
    } else {
      gasLimit = BigNumber.from(this.defaultGasLimit)
    }
    return gasLimit
  }

  async getNetwork (): Promise<any> {
    return `0x${this.provider.network.chainId.toString(16)}`
  }

  /**
   * Get wallet of the given's address, if managed
   */
  async getWalletByAddress (address: string): Promise<Wallet | undefined> {
    let accounts = await this.getAccounts()
    for (let ix = 0; ix < accounts.length; ix++) {
      if (accounts[ix].toLocaleLowerCase() === address.toLowerCase()) {
        return this.wallets[ix]
      }
    }
    return undefined
  }

  /**
   * Gets eth filter changes. Only EthBlockFilters are currently supported.
   */
  async mockEthFilterChanges (socket: SocketParams, id: string): Promise<any> {
    logger.verbose({ socket, message: `> Filter id: ${id}` })
    return [await this.provider.getBlock('latest')]
  }

  async processEthEstimateGas (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    // avoid some providers to just echo input gas limit
    if (params.gas) {
      params.gas = ''
    }
    const tx: ethers.providers.TransactionRequest =
      await this.composeTransaction(socket, params)
    return tx.gasLimit || this.defaultGasLimit
  }

  async processEthGasPrice (
    _socket: SocketParams,
    _params: TransactionParams
  ): Promise<any> {
    if (this.ethGasPriceFactor) {
      return '0x' + (await this.getGasPrice()).toNumber().toString(16)
    } else {
      const gp: BigNumber = BigNumber.from(await this.provider.getGasPrice())
      console.log(`0x${gp.toNumber().toString(16)}`)
      return `0x${gp.toNumber().toString(16)}`
    }
  }

  /**
   * Surrogates call to provider, after estimating/setting gas, if necessary.
   */
  async processEthCall (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    // Compose base transaction:
    let tx: ethers.providers.TransactionRequest = await this.composeTransaction(
      socket,
      params
    )
    if (this.interleaveBlocks > 0) {
      // Check for rollbacks, and get block tag:
      const blockTag =
        (await this.checkRollbacks(socket)) - this.interleaveBlocks
      logger.verbose({
        socket,
        message: `> Block tag: ${this.lastKnownBlock} --> ${blockTag}`
      })
      // Make the call:
      return this.provider.call(tx, blockTag)
    } else {
      return this.provider.call(tx)
    }
  }

  /**
   * Signs a message using the wallet's private key.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processEthSignMessage (
    address: string,
    message: string,
    socket: SocketParams
  ): Promise<any> {
    logger.verbose({
      socket,
      message: `=> Signing message: ${address} ${message}`
    })
    let wallet: Wallet | undefined = await this.getWalletByAddress(address)
    if (!wallet) {
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
    logger.verbose({ socket, message: `> Signing message "${message}"` })
    return wallet?.signMessage(message)
  }

  /**
   * Signs transaction using wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    // Check for rollbacks (and just trace a warning message if detected):
    this.checkRollbacks(socket)

    // Compose transaction:
    let tx: ethers.providers.TransactionRequest = await this.composeTransaction(
      socket,
      params
    )

    // Fetch Wallet interaction object:
    let wallet: Wallet | undefined = await this.getWalletByAddress(
      tx.from || (await this.getAccounts())[0]
    )
    if (!wallet) {
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

    // Add current nonce:
    if (!tx.nonce) {
      tx.nonce = await wallet?.getTransactionCount()
    }
    logger.verbose({ socket, message: `> Nonce:     ${tx.nonce}` })

    // Sign transaction:
    const signedTx = await wallet?.signTransaction(tx)
    logger.debug({ socket, message: `=> Signed tx:  ${signedTx}` })

    // Return transaction hash:
    const res = await this.provider.sendTransaction(signedTx)
    logger.debug({ socket, message: `<= ${JSON.stringify(res)}` })
    return res.hash
  }
}

export { WalletWrapper }
