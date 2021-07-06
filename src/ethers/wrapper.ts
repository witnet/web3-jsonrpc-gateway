import { ethers, Wallet } from 'ethers'
import { logger, SocketParams, zeroPad } from '../Logger'

interface TransactionParams {
  from: string,
  to: string,
  gas: string,
  gasPrice: string,
  value: string,
  data: string,
  nonce: string
}

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {
  wallet: Wallet
  provider: ethers.providers.JsonRpcProvider
  defaultGasPrice!: number
  defaultGasLimit!: number
  forceDefaults: boolean

  constructor (
    seed_phrase: string,
    provider: ethers.providers.JsonRpcProvider,
    gas_price: number,
    gas_limit: number,
    force_defaults: boolean,
  ) {
    this.wallet = Wallet.fromMnemonic(seed_phrase).connect(provider)
    this.provider = provider
    this.defaultGasPrice = gas_price
    this.defaultGasLimit = gas_limit
  }

  /**
   * Gets the address of the wallet.
   */
  async getAccounts () {
    return [await this.wallet.getAddress()]
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
    ): Promise<any>
  {
    logger.log({
      level: 'debug',
      socket,
      message: `=> Signing message: ${address} ${message}`
    })
    return this.wallet.signMessage(message)
  }

  /**
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (
      params: TransactionParams,
      socket: SocketParams
    ): Promise<any>
  {
    // Compose actual transaction:
    const tx = {    
      from: params.from,  
      to: params.to,
      gasLimit: this.forceDefaults ? this.defaultGasLimit : params.gas || this.defaultGasLimit,
      gasPrice: this.forceDefaults ? this.defaultGasPrice : params.gasPrice || this.defaultGasPrice,
      value: params.value,
      data: params.data,
      nonce: await wallet.getTransactionCount(),
      chainId: await wallet.getChainId()
    }

    await logger.verbose({socket, message: `> Chain id:  ${tx.chainId}`})
    
    // Sign transaction:
    const signedTx = await this.wallet.signTransaction(tx)
    await logger.log({level: 'debug', socket, message: `=> Signed tx:  ${signedTx}`})
    
    // Await transaction to be sent:
    const res = await this.provider.sendTransaction(signedTx)
    await logger.log({level: 'http', socket, message: `<< ${zeroPad(socket.serverId,4)}::${res.hash}`})
        
    // Return transaction hash:
    return res.hash
  }
}

export { WalletWrapper }
