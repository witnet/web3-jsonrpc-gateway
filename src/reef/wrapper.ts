import {
  TestAccountSigningKey,
  Provider,
  Signer
} from "@reef-defi/evm-provider";

import { HttpProvider, WsProvider, Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";

import { logger, SocketParams } from '../Logger'
import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

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
  graphUrl: string
  keyringPair: KeyringPair
  provider: Provider
  seedPhrase: string
  signer: Signer
  signingKey: TestAccountSigningKey
  wallet: ethers.Wallet
  
  constructor (
    rpcUrl: string,
    graphUrl: string,
    seedPhrase: string
  ) {
    this.graphUrl = graphUrl
    this.provider = new Provider(
      {
        provider: rpcUrl.startsWith("wss")
          ? new WsProvider(rpcUrl) 
          : new HttpProvider(rpcUrl)
      }
    )
    this.seedPhrase = seedPhrase
  }

  async setup () {
    await this.provider.api.isReady
    const keyring = new Keyring({ type: "sr25519" });
    this.keyringPair = keyring.addFromUri(this.seedPhrase);
    // console.log("pair.address =>", this.keyringPair.address)
    this.signingKey = new TestAccountSigningKey(this.provider.api.registry);
    this.signingKey.addKeyringPair(this.keyringPair);
    this.signer = new Signer(this.provider, this.keyringPair.address, this.signingKey);
    if (!(await this.signer.isClaimed())) {
      console.info(`Warning: No claimed EVM account found -> claimed default EVM account: ${await this.signer.getAddress()}`)
      await this.signer.claimDefaultAccount();
    }
    this.seedPhrase = ""
  }

  /**
   * Sends raw call to provider.
   * @param method JSON-RPC method
   * @param params JSON-RPC parameters
   * @returns
   */
  async call (
    socket: SocketParams,
    tx: any
  ): Promise<any> {
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
  return [await this.provider.getBlock('latest')]
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
      chainId: await this.signer.getChainId(),
      gasLimit: params.gas,
      gasPrice: params.gasPrice
    }
    if (tx.from) {
      logger.verbose({ socket, message: `> From:      ${tx.from}` })
    }    
    logger.verbose({ socket, message: `> To:        ${tx.to || '(deploy)'}` })
    logger.verbose({ socket,
      message: `> Data:      ${
        tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
      }`
    })
    logger.verbose({ socket, message: `> Value:     ${tx.value || 0} wei` })
    logger.verbose({ socket, message: `> ChainId:   ${tx.chainId}` })

    // Return tx object
    return tx
  }

  async estimateGas(
    socket: SocketParams,
    params: TransactionParams
  ): Promise<any> {
    const tx = await this.composeTransaction(socket, params)
    const gas = await this.provider.estimateGas(tx)
    return gas.toHexString()
  }

  async estimateGasPrice(_socket: SocketParams) : Promise<any> {
    return "0x1"
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
   async getAccounts () {
    let addresses = []
    addresses.push(await this.signer.queryEvmAddress())
    return addresses
  }

  async getBlockNumber (
    _socket: SocketParams,
    _params: any[]
  ): Promise<any> {
    const blockNumber = BigNumber.from(await this.provider.getBlockNumber())
    return blockNumber.toHexString()
  }

  async getBlockByNumber(
    socket: SocketParams,
    params: any    
  ): Promise<any> {
    let blockNumber
    if (params === "latest") {
      blockNumber = await this.provider.getBlockNumber()
    } else {
      blockNumber = parseInt(params)
    }
    logger.verbose({ socket, message: `=> querying data to ${this.graphUrl} ...`})
    const queryBlock = gql`
      {
        block (
          where: {
            id: {
              _eq: ${blockNumber}
            }
          }
        ) {
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
    const queryBlockExtrinsics = gql`
      {
        extrinsic (
          where: {
            block_id: {
              _eq: ${blockNumber}
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
    let data = await request(this.graphUrl, queryBlock)
    const block = data?.block[0]
    data = await request(this.graphUrl, queryBlockExtrinsics)
    const extrinsics: any[] = data?.extrinsic
    let res = null
    if (block) {
      const unixTs = Math.round(new Date(block.timestamp).getTime())/1000
      res = {
        hash: block.hash,
        parentHash: block.parent_hash,
        number: blockNumber,
        stateRoot: block.state_root,
        timestamp: unixTs,
        nonce: "0x0000000000000000",
        difficulty: 0,
        gasLimit: "0xffffffff",
        gasUsed: "0xffffffff",
        miner: "0x0000000000000000000000000000000000000000", 
        extraData: "0x",
        transactions: extrinsics.filter(obj => obj.events.length > 0).map(obj => obj.hash),
      }
    }
    return res
  }

  async getBalance(
    _socket: SocketParams,
    params: any
  ): Promise<any> {
    return (await this.provider.getBalance(params)).toHexString()
  }

  async getCode(
    _socket: SocketParams,
    params: any
  ): Promise<any> {
    return this.provider.getCode(params)
  }

  async getNetVersion(
    _socket: SocketParams
  ): Promise<any> {
    const network = await this.provider.getNetwork()
    return network.chainId
  }

  async getTransactionByHash(
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
    logger.verbose({ socket, message: `=> querying data to ${this.graphUrl} ...`})
    const data = await request(this.graphUrl, query)
    const extrinsic = data?.extrinsic[0]
    let res = null
    if (extrinsic && extrinsic.block.finalized) {
      try {
        const from = extrinsic.events[0]!.data[0]
        const nonce = await this.provider.getTransactionCount(from, extrinsic.block.hash)
        const gas = BigNumber.from(extrinsic.signed_data.fee.weight)
        const fee = BigNumber.from(extrinsic.signed_data.fee.partialFee)
        res = {
          hash: txHash,
          nonce: BigNumber.from(nonce).toHexString(),
          blockHash: extrinsic.block.hash,
          blockNumber: BigNumber.from(extrinsic.block.id).toHexString(),
          transactionIndex: `0x${extrinsic.events[0]!.index.toString(16)}`,
          from,
          to: extrinsic.events[0]!.method === "Created"
            ? null
            : extrinsic.events[0]!.data[1],
          value: BigNumber.from(extrinsic.args[1]).toHexString(),
          gasPrice: fee.div(gas).toHexString(),
          gas: gas.toHexString(),
          input: extrinsic.args[0]
        }
      } catch (ex) {
        logger.warn({ socket, message: `>< exception: ${ex}`})
        return null
      }
    }
    return res
  }

  async getTransactionReceipt(
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
    logger.verbose({ socket, message: `=> querying data to ${this.graphUrl} ...`})
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
          contractAddress: extrinsic.events[0]!.method === "Created"
            ? extrinsic.events[0]!.data[1]
            : null,
          status: extrinsic.status === "success"
            ? "0x1"
            : "0x0",
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
          logsBloom: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          from: extrinsic.events[0]!.data[0],
          to: extrinsic.events[0]!.method === "Created"
            ? null
            : extrinsic.events[0]!.data[1],
          effectiveGasPrice: fee.div(gas).toHexString(),
          type: "0x0",
        }
      } catch (ex) {
        logger.warn({ socket, message: `>< exception: ${ex}`})
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
   * Signs transactinon usings wallet's private key, before forwarding to provider.
   *
   * @remark Return type is made `any` here because the result needs to be a String, not a `Record`.
   */
  async sendTransaction (
    socket: SocketParams,
    params: any
  ): Promise<any> {
    (await this.provider.resolveApi).isReady
    
    let tx: ethers.providers.TransactionRequest = await this.composeTransaction(socket, params)
    // Add current nonce:
    if (!tx.nonce) {
      tx.nonce = await this.signer.getTransactionCount()
    }    
    logger.verbose({ socket, message: `> Nonce:     ${tx.nonce}` })

    // Return transaction hash:
    const res = await this.signer.sendTransaction(tx)
    logger.debug({ socket, message: `<= ${res}` })
    return res.hash
  }
}
