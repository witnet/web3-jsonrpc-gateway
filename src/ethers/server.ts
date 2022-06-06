import express, { Express } from 'express'
import cors from 'cors'
import { ethers, Wallet } from 'ethers'

import { logger, traceKeyValue } from '../Logger'
import { WalletWrapper } from './wrapper'

/**
 * Leverages `JsonRpcEngine` to intercept account-related calls, and pass any other calls down to a destination
 * provider, e.g. Infura.
 */
class WalletMiddlewareServer {
  alwaysSynced: boolean
  expressServer: Express
  mockFilters: boolean
  wrapper: WalletWrapper

  constructor (
    provider: ethers.providers.JsonRpcProvider,
    seed_phrase: string,    
    interleave_blocks: number,
    gas_price: number,
    gas_limit: number,
    force_defaults: boolean,
    num_addresses: number,
    estimate_gas_limit: boolean,
    estimate_gas_price: boolean,
    always_synced: boolean,
    mock_filters: boolean,
    gas_price_factor: number
  ) {
    this.alwaysSynced = always_synced
    this.expressServer = express()
    this.mockFilters = mock_filters
    this.wrapper = new WalletWrapper(
      provider,
      seed_phrase,
      interleave_blocks,
      gas_price,
      gas_limit,
      force_defaults,
      num_addresses,
      estimate_gas_limit,
      estimate_gas_price,
      gas_price_factor
    )

    let lines = [
      [
        'Entrypoint',
        `${provider.connection.url} ${
          provider.connection.allowGzip ? '(gzip)' : ''
        }`
      ],
      ['Force defs', force_defaults],
      [
        'Gas price',
        estimate_gas_price && !force_defaults ? '(self-estimated)' : gas_price
      ],
      [
        'Gas limit',
        estimate_gas_limit && !force_defaults ? '(self-estimated)' : gas_limit
      ]
    ]
    if (gas_price_factor > 0) {
      lines = [...lines, ['Gas price factor', `x ${gas_price_factor}`]]
    }
    if (interleave_blocks > 0) {
      lines = [...lines, ['Interleave blocks', interleave_blocks]]
    }
    traceKeyValue('Provider', lines)
    return this
  }

  /**
   * Initializes the Express server, configures CORS, and passes requests back and forth between the Express server and
   * the `JsonRpcEngine`.
   */
  initialize () {
    this.expressServer.use(cors())
    this.expressServer.use(express.json())

    this.expressServer.post(
      '*',
      async (req: express.Request, res: express.Response) => {
        const request = req.body
        const socket = {
          clientAddr: req.connection.remoteAddress,
          clientPort: req.connection.remotePort,
          clientId: request.id,
          serverId: this.wrapper.provider._nextId
        }

        logger.log({
          level: 'info',
          socket,
          message: `>> ${request.method}`
        })

        let handlers: { [K: string]: any } = {
          eth_accounts: this.wrapper.getAccounts,
          eth_call: this.wrapper.processEthCall,
          eth_getBlockByNumber: this.wrapper.getBlockByNumber,
          eth_sendTransaction: this.wrapper.processTransaction,
          eth_sign: this.wrapper.processEthSignMessage
        }
        if (this.alwaysSynced) {
          handlers = {
            ...handlers,
            eth_syncing: () => false
          }
        }
        if (this.mockFilters) {
          handlers = {
            ...handlers,
            eth_getFilterChanges: this.wrapper.mockEthFilterChanges,
            eth_newBlockFilter: () => "0x1"
          }
        }

        const header = {
          jsonrpc: request.jsonrpc,
          id: request.id
        }

        let response: {
          id: number
          jsonrpc: string
          result?: string
          error?: string
        }
        let result
        try {
          if (request.method in handlers) {
            result = await handlers[request.method].bind(this.wrapper)(
              socket,
              ...(request.params || [])
            )
          } else {
            result = await this.wrapper.provider.send(
              request.method,
              request.params
            )
          }
          response = { ...header, result }
        } catch (exception: any) {
          if (!exception.code) {
            // if no error code is specified,
            //   assume the provider is actually reporting an execution error:
            exception = {
              reason: exception.toString(),
              body: {
                error: {
                  code: -32015,
                  message: exception.data
                    ? 'Execution error'
                    : JSON.stringify(exception),
                  data: exception.data
                }
              }
            }
          }
          const message =
            exception.reason ||
            (exception.error && exception.error.reason) ||
            exception ||
            'null exception'
          let body =
            exception.body ||
            (exception.error && exception.error.body
              ? exception.error.body
              : {
                  error: {
                    code: exception.code || -32099,
                    message: `"${message}"`,
                    data: exception.data
                  }
                })
          body = typeof body !== 'string' ? JSON.stringify(body) : body
          try {
            response = { ...header, error: JSON.parse(body).error }
          } catch (e) {
            logger.log({
              level: 'error',
              socket,
              message: `<= Invalid JSON: ${body}`
            })
            response = {
              ...header,
              error: `{ "code": -32700, "message": "Invalid JSON response" }`
            }
          }
        }
        if (response.error) {
          logger.log({
            level: 'warn',
            socket,
            message: `<= Error: ${JSON.stringify(response.error)}`
          })
        } else {
          logger.log({
            level: 'http',
            socket,
            message: `<< ${JSON.stringify(result)}`
          })
        }
        res.status(200).json(response)
      }
    )
    return this
  }

  /**
   * Tells the Express server to start listening.
   */
  async listen (port: number, hostname?: string) {
    try {
      let network: ethers.providers.Network = await this.wrapper.provider.detectNetwork()
      if (network) {
        traceKeyValue('Network', [
          ['Network id', network.chainId],
          ['Network name', network.name],
          ['ENS address', network.ensAddress]
        ])
      }

      this.wrapper.wallets.forEach(async (wallet: Wallet, index) => {
        traceKeyValue(`Wallet #${index}`, [
          ['Address', await wallet.getAddress()],
          ['Balance', await wallet.getBalance()],
          ['Nonce  ', await wallet.getTransactionCount()]
        ])
      })
    } catch (e) {
      console.error(
        'Service provider seems to be down or rejecting connections !!!'
      )
      console.error(e)
      process.exit(-1)
    }

    traceKeyValue('Listener', [
      ['TCP/host', hostname || '0.0.0.0'],
      ['TCP/port', port],
      ['Log level', logger.level.toUpperCase()]
    ])

    this.expressServer.listen(port, hostname || '0.0.0.0')
    return this
  }
}

export { WalletMiddlewareServer }
