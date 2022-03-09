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
    console.log("pair.address =>", this.keyringPair.address)
    this.signingKey = new TestAccountSigningKey(this.provider.api.registry);
    this.signingKey.addKeyringPair(this.keyringPair);
    this.signer = new Signer(this.provider, this.keyringPair.address, this.signingKey);
    if (!(await this.signer.isClaimed())) {
      console.info(`Warning: No claimed EVM account found -> claimed default EVM account: ${await this.signer.getAddress()}`)
      await this.signer.claimDefaultAccount();
    }
    this.seedPhrase = ""
  }

  async version (
    _socket: SocketParams,
    _tx: TransactionParams    
  ): Promise<any> {
    return 13939
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
    const gasPrice = await this.provider.getGasPrice()
    return gasPrice.toHexString()
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
    return this.provider.getBlockNumber()
  }

  async getBlockByNumber(
    socket: SocketParams,
    params: any    
  ): Promise<any> {
    let blockNumber
    if (params === "latest") {
      blockNumber = await this.getBlockNumber(socket, params)
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
    console.log("block =>", block)
    data = await request(this.graphUrl, queryBlockExtrinsics)
    const extrinsics: any[] = data?.extrinsic
    let res = null
    if (block) {
      // const ts = block.timestamp?.replace("+00:00", "Z")
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
        miner: "0x0000000000000000000000000000000000000000", //block.author,
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
          logs: [],
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
    // console.log("res ====>", res)
    return res
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
    if (!tx.from) tx.from = await this.wallet.getAddress()
    if (tx.from) logger.verbose({ socket, message: `> From: ${tx.from}` })
    if (tx.to)
      logger.verbose({ socket, message: `> To: ${tx.to || '(deploy)'}` })
    if (tx.data)
      logger.verbose({
        socket,
        message: `> Data: ${
          tx.data ? tx.data.toString().substring(0, 10) + '...' : '(transfer)'
        }`
      })
    if (tx.nonce) logger.verbose({ socket, message: `> Nonce: ${tx.nonce}` })
    if (tx.value)
      logger.verbose({ socket, message: `> Value: ${tx.value || 0} wei` })
    if (tx.gas) 
      logger.verbose({ socket, message: `> Gas: ${tx.gas}` })
    if (tx.gasPrice)
      logger.verbose({ socket, message: `> Gas price: ${tx.gasPrice}` })

    // const call = this.api.tx.contracts.call(tx.to, tx.value, tx.gas, tx.data)
    const res = await this.provider.call({
      data: tx.data,
      to: tx.to,
      value: tx.value
    })
    console.log("res =>", res)
    return res
  }

  /**
   * Create new eth_client block filter.
   */
  async createEthBlockFilter (_socket: SocketParams): Promise<string> {
    return '0x1'
  }

  /**
   * Get syncing status from provider.
   */
  async getSyncingStatus (_socket: SocketParams): Promise<any> {
    return await this.provider.api.isReady
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
    console.log("tx ====>", tx)
    const res = await this.signer.sendTransaction(tx)
    logger.debug({ socket, message: `<= ${res}` })
    return res.hash
  }
}
