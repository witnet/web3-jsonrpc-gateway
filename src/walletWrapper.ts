import { ethers, Wallet } from 'ethers'

/**
 * Wraps the `ether` wallet / signer abstraction so it's compatible with the wallet middleware of
 * `eth-json-rpc-middleware`.
 */
class WalletWrapper {
  wallet: Wallet
  provider: ethers.providers.JsonRpcProvider

  constructor (
    seed_phrase: string,
    provider: ethers.providers.JsonRpcProvider
  ) {
    this.wallet = Wallet.fromMnemonic(seed_phrase).connect(provider)
    this.provider = provider
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
    console.log('Signing message', address, message)
    return await this.wallet.signMessage(message)
  }
}

export { WalletWrapper }
