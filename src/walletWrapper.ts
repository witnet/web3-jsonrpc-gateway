import { Wallet } from 'ethers'
import { JsonRpcRequest } from 'json-rpc-engine'

interface TransactionParams {
  from: string
}

interface MessageParams extends TransactionParams {
  data: string
}

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {
  wallet: Wallet

  constructor (seed_phrase: string) {
    this.wallet = Wallet.fromMnemonic(seed_phrase)
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
    msgParams: MessageParams,
    _req: JsonRpcRequest<unknown>
  ): Promise<any> {
    return await this.wallet.signMessage(msgParams.data)
  }
}

export { WalletWrapper }
