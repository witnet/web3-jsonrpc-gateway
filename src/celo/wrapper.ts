import { CeloProvider as Provider, CeloWallet as Wallet } from '@celo-tools/celo-ethers-wrapper'
import { logger, SocketParams, zeroPad } from '../Logger'

interface TransactionParams {
  from: string,
  to: string,
  gas: string,
  gasPrice: string,
  value: string,
  data: string,
  nonce: number,
  feeCurrency?: string
}

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {
  feeCurrency?: string
  provider: Provider
  wallet: Wallet

  constructor (    
    provider: Provider,
    privateKey: string,
    feeCurrency: string | undefined
  ) {
    this.provider = provider
    this.wallet = new Wallet(privateKey, provider)
    this.feeCurrency = feeCurrency
  }

  /**
   * Gets addresses of all managed wallets.
   */
  async getAccounts () : Promise<string[]> {
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
    logger.verbose({socket, message: `> Signing message "${message}"`})
    let res = await this.wallet.signMessage(message)
    return res
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
    let tx = {
      from: this.wallet.address,
      to: params.to,
      data: params.data,
      value: params.value,
      gasPrice: await this.wallet.getGasPrice(this.feeCurrency),
      nonce: await this.wallet.getTransactionCount(),
      chainId: await this.wallet.getChainId(),
      feeCurrency: this.feeCurrency || ""
    }
    const gasLimit = await this.wallet.estimateGas(tx)
    // TODO: get multiplier from configuration file
    const adjustedGasLimit = gasLimit.mul(3)

    await logger.verbose({socket, message: `> From:      ${tx.from}`})
    await logger.verbose({socket, message: `> To:        ${tx.to || '(deploy)'}`})
    await logger.verbose({socket, message: `> Data:      ${tx.data ? tx.data.substring(0, 10) + "..." : "(transfer)"}`})
    await logger.verbose({socket, message: `> Nonce:     ${tx.nonce}`})
    await logger.verbose({socket, message: `> Chain id:  ${tx.chainId}`})
    await logger.verbose({socket, message: `> Value:     ${tx.value || 0} wei`})    
    await logger.verbose({socket, message: `> Gas limit: ${adjustedGasLimit}`})
    await logger.verbose({socket, message: `> Gas price: ${tx.gasPrice}`})
    if (this.feeCurrency) await logger.verbose({socket, message: `> Fee currency: ${tx.feeCurrency}`})
    
    // Sign transaction:
    const signedTx = await this.wallet.signTransaction({ ...tx, gasLimit: adjustedGasLimit })
    await logger.log({level: 'debug', socket, message: `=> Signed tx:  ${signedTx}`})
    
    // Await transaction to be sent:
    const res = await this.provider.sendTransaction(signedTx)
    await logger.log({level: 'http', socket, message: `<< ${zeroPad(socket.serverId,4)}::${res.hash}`})
        
    // Return transaction hash:
    return res.hash
  }
}

export { WalletWrapper }
