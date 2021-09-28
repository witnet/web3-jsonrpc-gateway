import {
  CeloProvider as Provider,
  CeloWallet as Wallet
} from '@celo-tools/celo-ethers-wrapper'
import { newKit, ContractKit /*, CeloContract*/ } from '@celo/contractkit'
import { logger, SocketParams, zeroPad } from '../Logger'

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
  kit: ContractKit
  feeCurrency?: string
  gasLimitFactor: number
  gasPriceFactor: number
  maxPrice: number
  provider: Provider
  wallet: Wallet

  constructor (
    url: string,
    networkId: number,
    privateKey: string,
    feeCurrency: string | undefined,
    gasLimitFactor: number,
    gasPriceFactor: number,
    maxPrice: number
  ) {
    this.kit = newKit(url)
    this.feeCurrency = feeCurrency
    this.gasLimitFactor = gasLimitFactor
    this.gasPriceFactor = gasPriceFactor
    this.provider = new Provider(url, networkId)
    this.maxPrice = maxPrice
    this.wallet = new Wallet(privateKey, this.provider)
    this.kit.connection.addAccount(privateKey)
    // this.kit.setFeeCurrency(CeloContract.GoldToken)
  }

  /**
   * Gets addresses of all managed wallets.
   */
  async getAccounts (): Promise<string[]> {
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
  ): Promise<any> {
    logger.log({
      level: 'debug',
      socket,
      message: `=> Signing message: ${address} ${message}`
    })
    logger.verbose({ socket, message: `> Signing message "${message}"` })
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
  ): Promise<any> {
    // Estimate gas price
    // const feeCurrencyAddr = this.feeCurrency || (await this.kit.registry.addressFor(CeloContract.GoldToken)).toLowerCase()
    // const gasPriceMinimumContract = await this.kit.contracts.getGasPriceMinimum()
    // const gasPriceMinimum:any = await gasPriceMinimumContract.getGasPriceMinimum(feeCurrencyAddr)
    const gasPriceMinimum: any = await this.wallet.getGasPrice(this.feeCurrency)
    const gasPrice = Math.ceil(gasPriceMinimum * this.gasPriceFactor) // wiggle room if gas price minimum changes before tx is sent

    // Compose actual transaction:
    let tx = {
      from: this.wallet.address,
      to: params.to,
      data: params.data,
      value: params.value,
      gasPrice,
      nonce: await this.wallet.getTransactionCount(),
      chainId: await this.wallet.getChainId(),
      feeCurrency: this.feeCurrency || ''
    }
    let gasLimit = await this.wallet.estimateGas(tx)
    const adjustedGasLimit = gasLimit.mul(this.gasLimitFactor)

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

    // Sign transaction:
    const signedTx = await this.wallet.signTransaction({
      ...tx,
      gasLimit: adjustedGasLimit
    })
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
      message: `<< ${zeroPad(socket.serverId, 4)}::${res.hash}`
    })

    // Return transaction hash:
    return res.hash
  }
}

export { WalletWrapper }
