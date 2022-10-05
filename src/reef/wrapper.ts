import {
  TestAccountSigningKey,
  Provider,
  Signer
} from '@reef-defi/evm-provider'

import { HttpProvider, WsProvider, Keyring } from '@polkadot/api'
import { KeyringPair } from '@polkadot/keyring/types'

import { logger, SocketParams } from '../Logger'
import { ethers } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'

import { request, gql } from 'graphql-request'

const pckg = require('../../package')

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
 * Wraps the Conflux Wallet so it's compatible with the RPC gateway of
 * `web3-jsonrpc-gateway`.
 */

export class WalletWrapper {
  accounts: string[]
  graphUrl: string
  keyring: Keyring
  keyringPairs: KeyringPair[]
  numAddresses: number
  provider: Provider
  seedPhrase: string
  signers: Signer[]
  signingKey: TestAccountSigningKey

  constructor (
    rpcUrl: string,
    graphUrl: string,
    seedPhrase: string,
    numAddresses: number
  ) {
    this.accounts = []
    this.graphUrl = graphUrl
    this.keyringPairs = []
    this.numAddresses = numAddresses
    this.provider = new Provider({
      provider: rpcUrl.startsWith('wss')
        ? new WsProvider(rpcUrl)
        : new HttpProvider(rpcUrl)
    })
    this.seedPhrase = seedPhrase
    this.signers = []
  }

  async setup () {
    await this.provider.api.isReady
    this.keyring = new Keyring({ type: 'sr25519' })
    this.signingKey = new TestAccountSigningKey(this.provider.api.registry)
    for (let j = 0; j < this.numAddresses; j++) {
      const uri = j == 0 ? this.seedPhrase : `${this.seedPhrase}//${j}`
      const keyringPair = this.keyring.addFromUri(uri)
      const signer = new Signer(
        this.provider,
        keyringPair.address,
        this.signingKey
      )
      if (!(await signer.isClaimed())) {
        console.info(
          `Warning: no claimed EVM account found for ${keyringPair.address}:`
        )
        await signer.claimDefaultAccount()
        console.info(`=> claimed ${await signer.getAddress()}`)
      }
      this.accounts.push(await signer.getAddress())
      this.signers.push(signer)
      this.keyringPairs.push(keyringPair)
    }
    this.seedPhrase = ''
    this.signingKey.addKeyringPair(this.keyringPairs)
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns
   */
  async call (socket: SocketParams, tx: any): Promise<any> {
    if (tx.from) {
      logger.verbose({ socket, message: `> From: ${tx.from}` })
    }
    if (tx.to) {
      logger.verbose({ socket, message: `> To: ${tx.to || '(deploy)'}` })
    }
    if (tx.data) {
      logger.verbose({
        socket,
        message: `> Data: ${
          tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
        }`
      })
    }
    if (tx.nonce) {
      logger.verbose({ socket, message: `> Nonce: ${tx.nonce}` })
    }
    if (tx.value) {
      logger.verbose({ socket, message: `> Value: ${tx.value || 0} wei` })
    }
    if (tx.gas) {
      logger.verbose({ socket, message: `> Gas: ${tx.gas}` })
    }
    if (tx.gasPrice) {
      logger.verbose({ socket, message: `> Gas price: ${tx.gasPrice}` })
    }

    // const call = this.api.tx.contracts.call(tx.to, tx.value, tx.gas, tx.data)
    const res = await this.provider.call({
      data: tx.data,
      to: tx.to,
      value: tx.value
    })
    return res
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
  ): Promise<ethers.providers.TransactionRequest> {
    // Compose actual transaction:
    let tx: ethers.providers.TransactionRequest = {
      from: params.from,
      to: params.to,
      value: params.value,
      data: params.data,
      nonce: params.nonce,
      gasLimit: params.gas,
      gasPrice: params.gasPrice
    }
    if (tx.from) {
      logger.verbose({ socket, message: `> From:      ${tx.from}` })
    }
    logger.verbose({ socket, message: `> To:        ${tx.to || '(deploy)'}` })
    logger.verbose({
      socket,
      message: `> Data:      ${
        tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
      }`
    })
    logger.verbose({ socket, message: `> Value:     ${tx.value || 0} wei` })
    if (tx.gasPrice) {
      logger.verbose({ socket, message: `> Gas price: ${tx.gasPrice}` })
    }
    if (tx.gasLimit) {
      logger.verbose({ socket, message: `> Gas limit: ${tx.gasLimit}` })
    }

    // Return tx object
    return tx
  }

  async estimateGas (
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    const tx = await this.composeTransaction(socket, params)
    if (!tx.from) {
      const accounts: string[] = await this.getAccounts()
      tx.from = accounts[0]
    }
    const gas = await this.provider.estimateGas(tx)
    return gas.toHexString()
  }

  async estimateGasPrice (_socket: SocketParams): Promise<any> {
    return '0x1'
    // const blockNumber = await this.provider.getBlockNumber()
    // const query = gql`
    //   {
    //     extrinsic (
    //       where: {
    //         _and: [
    //           { block_id: { _gte: ${blockNumber - 3000} }},
    //           { signed_data: { _is_null: false }}
    //         ]
    //       }
    //     ) {
    //       signed_data
    //     }
    //   }
    // `
    // const data = await request(this.graphUrl, query)
    // if (data && data.extrinsic) {
    //   const txs: any[] = data?.extrinsic
    //   const gasPrices: BigNumber[] = txs.map(tx => {
    //     const gas = BigNumber.from(tx.signed_data.fee.weight)
    //     const fee = BigNumber.from(tx.signed_data.fee.partialFee)
    //     return fee.div(gas)
    //   })
    //   if (gasPrices.length > 0) {
    //     const sumGasPrices: BigNumber = gasPrices.reduce((acc: BigNumber, val: BigNumber) => {
    //       return acc.add(val)
    //     })
    //     return sumGasPrices.div(gasPrices.length).toHexString()
    //   }
    // }
    // return 10 ** 10;
  }

  /**
   * Gets addresses of the wallet.
   */
  getAccounts (): string[] {
    return this.accounts
  }

  async getSignerFromEvmAddress (evmAddress: string): Promise<any> {
    for (let j = 0; j < this.signers.length; j++) {
      const signer = this.signers[j]
      const addr = await signer?.getAddress()
      if (addr.toLowerCase() === evmAddress.toLowerCase()) {
        return signer
      }
    }
    const reason = `No private key available as to sign messages from '${evmAddress}'`
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

  async getBlockNumber (_socket: SocketParams, _params: any[]): Promise<any> {
    const blockNumber = BigNumber.from(await this.provider.getBlockNumber())
    return blockNumber.toHexString()
  }

  async getBlockByNumber (socket: SocketParams, _params: any): Promise<any> {
    logger.verbose({
      socket,
      message: `=> querying data to ${this.graphUrl} ...`
    })
    const queryBlock = gql`
      {
        block(
          order_by: { id: desc_nulls_last }
          limit: 1
          where: { finalized: { _eq: true } }
        ) {
          id
          author
          hash
          parent_hash
          finalized
          extrinsic_root
          state_root
          timestamp
        }
      }
    `
    let res = null
    let data = await request(this.graphUrl, queryBlock)
    const block = data?.block[0]
    if (block?.id) {
      const queryBlockExtrinsics = gql`
        {
          extrinsic (
            where: {
              block_id: {
                _eq: ${block.id}
              }
            }
          ) {
            hash
            events (
              where: {
                section: {
                  _eq: "evm"
                }
              }
            ) {
              method
            }
          }
        }
      `
      data = await request(this.graphUrl, queryBlockExtrinsics)
      const extrinsics: any[] = data?.extrinsic
      const unixTs = Math.round(new Date(block.timestamp).getTime()) / 1000
      res = {
        hash: block.hash,
        parentHash: block.parent_hash,
        number: block.id,
        stateRoot: block.state_root,
        timestamp: unixTs,
        nonce: '0x0000000000000000',
        difficulty: 0,
        gasLimit: '0xffffffff',
        gasUsed: '0xffffffff',
        miner: '0x0000000000000000000000000000000000000000',
        extraData: '0x',
        transactions: extrinsics
          .filter(obj => obj.events.length > 0)
          .map(obj => obj.hash)
      }
    }
    return res
  }

  async getBalance (_socket: SocketParams, params: any): Promise<any> {
    return (await this.provider.getBalance(params)).toHexString()
  }

  async getCode (_socket: SocketParams, params: any): Promise<any> {
    return this.provider.getCode(params)
  }

  async getNetVersion (_socket: SocketParams): Promise<any> {
    const network = await this.provider.getNetwork()
    return network.chainId
  }

  async getTransactionByHash (
    socket: SocketParams,
    txHash: string
  ): Promise<any> {
    const query = gql`
      {
        extrinsic (
          where: {
            hash: {
              _eq: "${txHash}"
            }
          }
        ) {
          id
          block {
            id
            hash
            finalized
          }
          status
          timestamp
          events (
            where: {
              section: {
                _eq: "evm"
              }
            }
          ) {
            data
            method
            index
          }
          args
          signed_data
        }
      }
    `
    logger.verbose({
      socket,
      message: `=> querying data to ${this.graphUrl} ...`
    })
    const data = await request(this.graphUrl, query)
    const extrinsic = data?.extrinsic[0]
    let res = null
    if (extrinsic && extrinsic.block.finalized) {
      try {
        const from = extrinsic.events[0]!.data[0]
        const nonce = await this.provider.getTransactionCount(
          from,
          extrinsic.block.hash
        )
        const gas = BigNumber.from(extrinsic.signed_data.fee.weight)
        const fee = BigNumber.from(extrinsic.signed_data.fee.partialFee)
        res = {
          hash: txHash,
          nonce: BigNumber.from(nonce).toHexString(),
          blockHash: extrinsic.block.hash,
          blockNumber: BigNumber.from(extrinsic.block.id).toHexString(),
          transactionIndex: `0x${extrinsic.events[0]!.index.toString(16)}`,
          from,
          to:
            extrinsic.events[0]!.method === 'Created'
              ? null
              : extrinsic.events[0]!.data[1],
          value: BigNumber.from(extrinsic.args[1]).toHexString(),
          gasPrice: fee.div(gas).toHexString(),
          gas: gas.toHexString(),
          input: extrinsic.args[0]
        }
      } catch (ex) {
        logger.warn({ socket, message: `>< exception: ${ex}` })
        return null
      }
    }
    return res
  }

  async getTransactionReceipt (
    socket: SocketParams,
    txHash: string
  ): Promise<any> {
    const query = gql`
      {
        extrinsic (
          where: {
            hash: {
              _eq: "${txHash}"
            }
          }
        ) {
          args
          id
          block {
            id
            hash
            finalized
          }
          events (
            where: {
              _and: [
                { section: { _eq: "evm" }},
                {
                  _or: [
                    { method: { _eq: "Executed" }},
                    { method: { _eq: "Created" }}
                  ]
                }
              ]
            }
          ) {
            data
            index
            method
          }
          index
          signed_data
          status
          timestamp
        }
      }
    `
    const logsQuery = gql`
      {
        extrinsic (
          where: {
            hash: {
              _eq: "${txHash}"
            }
          }
        ) {
          events (
            order_by: { index: asc },
            where: {
              _and: [
                { section: { _eq: "evm" }},
                { method: { _eq: "Log" }}
              ]
            }
          ) {
            data
          }
        }
      }
    `
    logger.verbose({
      socket,
      message: `=> querying data to ${this.graphUrl} ...`
    })
    const data = await request(this.graphUrl, query)
    const extrinsic = data?.extrinsic[0]
    let res = null
    if (extrinsic && extrinsic.block.finalized) {
      const logsData = await request(this.graphUrl, logsQuery)
      const events: any[] = logsData?.extrinsic[0].events
      try {
        const gas = BigNumber.from(extrinsic.signed_data.fee.weight)
        const fee = BigNumber.from(extrinsic.signed_data.fee.partialFee)
        res = {
          transactionHash: txHash,
          transactionIndex: `0x${extrinsic.events[0]!.index.toString(16)}`,
          blockHash: extrinsic.block.hash,
          blockNumber: BigNumber.from(extrinsic.block.id).toHexString(),
          cumulativeGasUsed: gas.toHexString(),
          gasUsed: gas.toHexString(),
          contractAddress:
            extrinsic.events[0]!.method === 'Created'
              ? extrinsic.events[0]!.data[1]
              : null,
          status: extrinsic.status === 'success' ? '0x1' : '0x0',
          logs: events?.map((event: any, index) => {
            const log = event.data[0]
            return {
              removed: false,
              logIndex: `0x${index.toString(16)}`,
              transactionIndex: `0x${extrinsic.index}`,
              transactionHash: txHash,
              blockHash: extrinsic.block.hash,
              blockNumber: BigNumber.from(extrinsic.block.id).toHexString(),
              address: log.address,
              data: log.data,
              topics: log.topics
            }
          }),
          logsBloom:
            '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          from: extrinsic.events[0]!.data[0],
          to:
            extrinsic.events[0]!.method === 'Created'
              ? null
              : extrinsic.events[0]!.data[1],
          effectiveGasPrice: fee.div(gas).toHexString(),
          type: '0x0'
        }
      } catch (ex) {
        logger.warn({ socket, message: `>< exception: ${ex}` })
        return null
      }
    }
    return res
  }

  /**
   * Get syncing status from provider.
   */
  async getSyncingStatus (_socket: SocketParams): Promise<any> {
    return false
  }

  async getWeb3Version (
    _socket: SocketParams,
    _tx: TransactionParams
  ): Promise<any> {
    return `${pckg.name} v${pckg.version}`
  }

  /**
   * Create new eth_client block filter.
   */
  async mockCreateBlockFilter (_socket: SocketParams): Promise<string> {
    return '0x1'
  }

  /**
   * Gets eth filter changes. Only EthBlockFilters are currently supported.
   */
  async mockGetFilterChanges (socket: SocketParams, id: string): Promise<any> {
    logger.verbose({ socket, message: `> Filter id: ${id}` })
    return [await this.provider.getBlockNumber()]
  }

  /**
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async sendTransaction (socket: SocketParams, params: any): Promise<any> {
    ;(await this.provider.resolveApi).isReady
    let tx: ethers.providers.TransactionRequest = await this.composeTransaction(
      socket,
      params
    )
    const signer = await this.getSignerFromEvmAddress(tx.from || '')
    // make sure `tx.from` syntax is just as expected from a Reef Signer
    tx.from = await signer.getAddress()

    // Add current nonce:
    if (!tx.nonce) {
      tx.nonce = await signer?.getTransactionCount()
    }
    logger.verbose({ socket, message: `> Nonce:     ${tx.nonce}` })

    // Return transaction hash:
    const res = await signer?.sendTransaction(tx)
    logger.debug({ socket, message: `<= ${JSON.stringify(res)}` })
    return res.hash
  }
}
