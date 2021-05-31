import { ethers, Wallet } from 'ethers'

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
  async processEthSignMessage (address: string, message: string): Promise<any> {
    console.log('Signing message:', address, message)
    return this.wallet.signMessage(message)
  }

  /**
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async processTransaction (params: TransactionParams): Promise<any> {
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
    console.log(`Transaction => (from: ${tx.from} to: ${tx.to || '(create)'} gas: ${tx.gasLimit} value: ${tx.value || 0} nonce: ${tx.nonce} data: ${tx.data.length/2 - 1} bytes)`)
    
    // Sign transaction:
    const signedTx = await this.wallet.signTransaction(tx)
    
    // Await transaction to be sent:
    const res = await this.provider.sendTransaction(signedTx)
    
    // Return transaction hash:
    return res.hash
  }
}

export { WalletWrapper }
