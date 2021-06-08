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

  constructor (
    seed_phrase: string,
    provider: ethers.providers.JsonRpcProvider,
    gas_price: number,
    gas_limit: number
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
      gasLimit: params.gas || this.defaultGasLimit,
      gasPrice: params.gasPrice || this.defaultGasPrice,
      value: params.value,
      data: params.data,
      nonce: await this.wallet.getTransactionCount(),
    }

    await logger.log({level: 'verbose', socket, message: `> From:      ${tx.from}`})
    await logger.log({level: 'verbose', socket, message: `> To:        ${tx.to || '(deploy)'}`})
    await logger.log({level: 'verbose', socket, message: `> Data:      ${tx.data ? tx.data.substring(0, 10) + "..." : "(transfer)"}`})
    await logger.log({level: 'verbose', socket, message: `> Nonce:     ${tx.nonce}`})
    await logger.log({level: 'verbose', socket, message: `> Value:     ${tx.value || 0} wei`})
    await logger.log({level: 'verbose', socket, message: `> Gas limit: ${tx.gasLimit}`})
    await logger.log({level: 'verbose', socket, message: `> Gas price: ${tx.gasPrice}`})
    
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
