import { BigNumber, ethers, Wallet } from 'ethers'
import { logger, SocketParams } from '../Logger'

interface TransactionParams {
  from: string
  to: string
  gas: string
  gasPrice: string
  value: string
  data: string
  nonce: string
}

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {
  wallets: Wallet[]
  provider: ethers.providers.JsonRpcProvider
  defaultGasPrice!: number
  defaultGasLimit!: number
  forceDefaults: boolean
  estimateGasLimit: boolean
  estimateGasPrice: boolean

  constructor (
    seed_phrase: string,
    provider: ethers.providers.JsonRpcProvider,
    gas_price: number,
    gas_limit: number,
    force_defaults: boolean,
    num_addresses: number,
    estimate_gas_limit: boolean,
    estimate_gas_price: boolean
  ) {
    this.wallets = []
    for (let ix = 0; ix < num_addresses; ix++) {
      this.wallets.push(
        Wallet.fromMnemonic(seed_phrase, `m/44'/60'/0'/0/${ix}`).connect(
          provider
        )
      )
    }
    this.provider = provider
    this.defaultGasPrice = gas_price
    this.defaultGasLimit = gas_limit
    this.forceDefaults = force_defaults
    this.estimateGasLimit = estimate_gas_limit
    this.estimateGasPrice = estimate_gas_price
  }

  /**
   * Gets addresses of all managed wallets.
   */
  async getAccounts (): Promise<string[]> {
    let accounts: string[] = []
    this.wallets.forEach(async (wallet: Wallet) =>
      accounts.push(await wallet.getAddress())
    )
    return accounts
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
   * Signs a message using the wallet's private key.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processEthSignMessage (
    address: string,
    message: string,
    socket: SocketParams
  ): Promise<any> {
    logger.log({
      level: 'debug',
      socket,
      message: `=> Signing message: ${address} ${message}`
    })
    let wallet: Wallet | undefined = await this.getWalletByAddress(address)
    if (wallet != undefined) {
      logger.verbose({ socket, message: `> Signing message "${message}"` })
      let res = await wallet.signMessage(message)
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
   * Signs transaction using wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (
    params: TransactionParams,
    socket: SocketParams
  ): Promise<any> {
    let wallet: Wallet | undefined = await this.getWalletByAddress(params.from)
    if (wallet == undefined) {
      let reason = `No private key available as to sign transactions from '${params.from}'`
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
    // Compose actual transaction:
    let tx: ethers.providers.TransactionRequest = {
      from: params.from,
      to: params.to,
      value: params.value,
      data: params.data,
      nonce: await wallet.getTransactionCount(),
      chainId: await wallet.getChainId()
    }
    // Estimate gas price, if neccesary:
    let gasPrice: BigNumber
    if (this.estimateGasPrice) {
      gasPrice = this.forceDefaults
        ? BigNumber.from(this.defaultGasPrice)
        : await this.provider.getGasPrice()
      const gasPriceThreshold = params.gasPrice
        ? BigNumber.from(params.gasPrice)
        : BigNumber.from(this.defaultGasPrice)
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
      gasPrice = this.forceDefaults
        ? BigNumber.from(this.defaultGasPrice)
        : params.gasPrice
        ? BigNumber.from(params.gasPrice)
        : BigNumber.from(this.defaultGasPrice)
    }
    // Estimate gas limit, if neccesary:
    let gasLimit: BigNumber
    if (this.estimateGasLimit) {
      gasLimit = this.forceDefaults
        ? BigNumber.from(this.defaultGasLimit)
        : await this.provider.estimateGas(tx)
      const gasLimitThreshold: BigNumber = params.gas
        ? BigNumber.from(params.gas)
        : BigNumber.from(this.defaultGasLimit)
      if (gasLimit.gt(gasLimitThreshold)) {
        let reason = `Estimated gas limit exceeds threshold (${gasLimit} > ${gasLimitThreshold})`
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
      gasLimit = this.forceDefaults
        ? BigNumber.from(this.defaultGasLimit)
        : params.gas
        ? BigNumber.from(params.gas)
        : BigNumber.from(this.defaultGasLimit)
    }
    // Fulfill unsigned tx:
    tx.gasPrice = gasPrice.toHexString()
    tx.gasLimit = gasLimit.toHexString()

    await logger.verbose({ socket, message: `> From:      ${tx.from}` })
    await logger.verbose({
      socket,
      message: `> To:        ${tx.to || '(deploy)'}`
    })
    await logger.verbose({
      socket,
      message: `> Data:      ${
        tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
      }`
    })
    await logger.verbose({ socket, message: `> Nonce:     ${tx.nonce}` })
    await logger.verbose({ socket, message: `> Chain id:  ${tx.chainId}` })
    await logger.verbose({
      socket,
      message: `> Value:     ${tx.value || 0} wei`
    })
    await logger.verbose({ socket, message: `> Gas limit: ${tx.gasLimit}` })
    await logger.verbose({ socket, message: `> Gas price: ${tx.gasPrice}` })

    // Sign transaction:
    const signedTx = await wallet.signTransaction(tx)
    await logger.log({
      level: 'debug',
      socket,
      message: `=> Signed tx:  ${signedTx}`
    })

    // Await transaction to be sent:
    const res = await this.provider.sendTransaction(signedTx)
    await logger.log({
      level: 'http',
      socket,
      message: `<< ${res.hash}`
    })

    // Return transaction hash:
    return res.hash
  }
}

export { WalletWrapper }
