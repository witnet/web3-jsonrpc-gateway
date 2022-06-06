import {
  CeloProvider as Provider,
  CeloWallet as Wallet
} from '@celo-tools/celo-ethers-wrapper'
import { newKit, ContractKit } from '@celo/contractkit'
import { logger, SocketParams } from '../Logger'

interface TransactionParams {
  from: string
  to: string
  gas: string
  gasPrice: string
  value: string
  data: string
  nonce: number
  feeCurrency?: string
}

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {  
  feeCurrency?: string
  gasLimitFactor: number
  gasPriceFactor: number
  gasPriceMax: number
  interleaveBlocks: number
  kit: ContractKit
  lastKnownBlock: number
  networkId: number
  provider: Provider
  wallets: Wallet[]

  constructor (
    url: string,
    networkId: number,
    privateKeys: string[],
    interleaveBlocks: number,
    feeCurrency: string | undefined,
    gasLimitFactor: number,
    gasPriceFactor: number,
    gasPriceMax: number
  ) {
    this.feeCurrency = feeCurrency
    this.gasLimitFactor = gasLimitFactor
    this.gasPriceFactor = gasPriceFactor
    this.gasPriceMax = gasPriceMax
    this.interleaveBlocks = interleaveBlocks
    this.kit = newKit(url)
    // this.kit.setFeeCurrency(CeloContract.GoldToken)
    this.lastKnownBlock = 0
    this.networkId = networkId
    this.provider = new Provider(url, networkId)
    this.wallets = []
    privateKeys.forEach(privateKey => {
      this.kit.connection.addAccount(privateKey)
      this.wallets.push(new Wallet(privateKey, this.provider))
    })
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
  ): Promise<any> {

    // Estimate gas price:
    const gasPrice = await this.processEthGasPrice()
    if (gasPrice > this.gasPriceMax) {
      let reason = `Estimated gas price exceeds threshold (${this.gasPriceMax})`
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

    // Compose base transaction:
    let tx: any = {
      from: params.from || this.getAccounts()[0],
      to: params.to,
      data: params.data,
      gasPrice,
      value: params.value,
      chainId: this.networkId,      
      feeCurrency: this.feeCurrency || ''
    }

    // Estimate gas limit, if not specified, but `params.from` is:
    const gasLimit = await this.processEthEstimateGas(socket, tx)
    tx = {
      ...tx,
      gasLimit: gasLimit
    }

    // Trace tx params
    await logger.verbose({ socket, message: `> From:      ${tx.from}` })
    await logger.verbose({
      socket,
      message: `> To:        ${tx.to || '(deploy)'}`
    })
    await logger.verbose({
      socket,
      message: `> Data:      ${
        tx.data ? tx.data.substring(0, 10) + '...' : '(transfer)'
      }`
    })
    await logger.verbose({ socket, message: `> Nonce:     ${tx.nonce}` })
    await logger.verbose({ socket, message: `> Chain id:  ${tx.chainId}` })
    await logger.verbose({
      socket,
      message: `> Value:     ${BigInt(tx.value ?? 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',') || 0} wei`
    })
    await logger.verbose({
      socket,
      message: `> Gas limit: ${adjustedGasLimit
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',')} gas`
    })
    await logger.verbose({
      socket,
      message: `> Gas price: ${tx.gasPrice
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',')} wei / gas`
    })
    await logger.verbose({
      socket,
      message: `> Fee currency: ${tx.feeCurrency || 'default'}`
    })

    // Return tx object:
    return tx
  }

  /**
   * Check for possible rollbacks on the EVM side. 
   * @param socket Socket parms where the RPC call is coming from
   * @returns Last known block number.
   */
  async checkRollbacks(socket: SocketParams): Promise<number> {
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
          message: `Harmless rollback: from epoch ${this.lastKnownBlock} down to ${block}`
        })
      }
    }
    this.lastKnownBlock = block
    return block
  }

  /**
   * Gets Wallet interaction object of given address, if available.
   */
  getAccount (address: string): Wallet | undefined {
    return this.wallets.find(wallet => wallet.address.toLowerCase() === address.toLowerCase())
  }

  /**
   * Gets addresses of all managed wallets.
   */
  getAccounts (): string[] {
    return this.wallets.map(wallet => wallet.address)
  }

  async processEthAccounts (
    _socket: SocketParams,
    _params: TransactionParams
  ): Promise<string[]> {
    return this.getAccounts()
  }

  /**
   * Surrogates call to provider, after estimating/setting gas, if necessary.
   */
  async processEthCall (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    // Check for rollbackas, and get block tag:
    const blockTag = await this.checkRollbacks(socket) - this.interleaveBlocks
    logger.verbose({ socket, message: `> Block tag: ${this.lastKnownBlock} --> ${blockTag}` })

    // Compose base transaction:
    const tx = await this.composeTransaction(socket, params)

    // Make call:
    return await this.provider.call(tx, blockTag)
  }

  /**
   * Estimates gas limit by multiplying configured gasLimitFactor.
   * @param _socket 
   * @param params Transaction params.
   * @returns 
   */
  async processEthEstimateGas (
    _socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    // Compose transaction
    let tx: any = {
      from: params.from || this.getAccounts()[0],
      to: params.to,
      data: params.data,
      value: params.value,
      chainId: this.networkId,
      feeCurrency: this.feeCurrency || ''
    }
    const gasLimit: BigNumber = await this.provider.estimateGas(tx)
    const res = gasLimit.mul(this.gasLimitFactor)
    return res.toHexString()
  }

  /**
   * Estimates current gas price.
   */
  async processEthGasPrice (): Promise<any> {
    const gasPriceMinimum: any = await this.provider.getGasPrice(this.feeCurrency)
    return `0x${Math.ceil(gasPriceMinimum * this.gasPriceFactor).toString(16)}`
  }

  /**
   * Signs a message using the wallet's private key.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processEthSignMessage (
    socket: SocketParams,
    address: string,
    message: string,
  ): Promise<any> {
    const wallet = await this.getAccount(address)
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
    logger.verbose({ socket, message: `> Sigining message "${message}" from ${address}...` })
    return wallet?.signMessage(message)
  }

  /**
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    // Check for rollbacks (and just trace a warning message if detected):
    this.checkRollbacks(socket)

    // Compose transaction
    let tx: any = await this.composeTransaction(socket, params)

    // Fetch Account interaction object:
    const account = this.getAccount(tx.from)
    if (!account) {
      let reason = `No private key available as to sign messages from '${tx.from}'`
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
    tx = {
      ...tx,
      nonce: await account?.getTransactionCount()
    }
    await logger.verbose({ socket, message: `> Nonce:     ${tx.nonce}` })
    
    // Sign transaction:
    const signedTx = await account?.signTransaction(tx)
    await logger.debug({ socket, message: `=> Signed tx: ${signedTx}` })

    // Return transaction hash:
    const res = await this.provider.sendTransaction(signedTx)
    await logger.debug({ socket, message: `<= ${JSON.stringify(res)}` })
    return res.hash
  }
}

export { WalletWrapper }
