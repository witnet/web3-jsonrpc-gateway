import { Conflux } from 'js-conflux-sdk'
// import { logger, SocketParams, zeroPad } from '../../Logger'
import { SocketParams } from '../Logger'

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

type JSBI = BigInt
export class WalletWrapper {
  account: Account
  defaultGas: JSBI
  conflux: Conflux
  networkId: number
  
  constructor (
    networkId: number,
    privateKey: string,
    defaultGas: JSBI,
    conflux: Conflux
  ) {
    this.networkId = networkId
    this.defaultGas = defaultGas
    this.conflux = conflux
    this.account = this.conflux.wallet.addPrivateKey(privateKey)
  }

  /**
   * Gets wallet's master address info.
   */
  async getInfo() {
    return this.provider.getAccount(this.address)
  }

  /**
   * Gets addresses of the wallet.
   */
  getAccounts () {
    let accounts:string[] = []
    this.conflux.wallet.forEach((key) => accounts.push(key.account))
    return accounts
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns 
   */
  async send(method: string, params: string) {
    return this.provider.provider.call(method, params)
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
    //   message: `=> Signing message: ${address} ${message}`
    // })
    // return this.wallet.signMessage(message)
  }

  /**
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (
      _params: TransactionParams,
      _socket: SocketParams
    ): Promise<any>
  {
    // // Compose actual transaction:
    // const tx = {    
    //   from: params.from,  
    //   to: params.to,
    //   gasLimit: params.gas || this.defaultGasLimit,
    //   gasPrice: params.gasPrice || this.defaultGasPrice,
    //   value: params.value,
    //   data: params.data,
    //   nonce: await this.wallet.getTransactionCount(),
    // }

    // await logger.log({level: 'verbose', socket, message: `> From:      ${tx.from}`})
    // await logger.log({level: 'verbose', socket, message: `> To:        ${tx.to || '(deploy)'}`})
    // await logger.log({level: 'verbose', socket, message: `> Data:      ${tx.data ? tx.data.substring(0, 10) + "..." : "(transfer)"}`})
    // await logger.log({level: 'verbose', socket, message: `> Nonce:     ${tx.nonce}`})
    // await logger.log({level: 'verbose', socket, message: `> Value:     ${tx.value || 0} wei`})
    // await logger.log({level: 'verbose', socket, message: `> Gas limit: ${tx.gasLimit}`})
    // await logger.log({level: 'verbose', socket, message: `> Gas price: ${tx.gasPrice}`})
    
    // // Sign transaction:
    // const signedTx = await this.wallet.signTransaction(tx)
    // await logger.log({level: 'debug', socket, message: `=> Signed tx:  ${signedTx}`})
    
    // // Await transaction to be sent:
    // const res = await this.provider.sendTransaction(signedTx)
    // await logger.log({level: 'http', socket, message: `<< ${zeroPad(socket.serverId,4)}::${res.hash}`})
        
    // // Return transaction hash:
    // return res.hash
  }
}

export { WalletWrapper }
