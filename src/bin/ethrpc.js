#!/usr/bin/env node
require('dotenv').config()
const execSync = require('child_process').execSync
const scripts = require('../../package.json').scripts

console.info(
  `ETHRPC GATEWAY v${require('../../package.json')?.version}`
)

if (process.argv.length >= 3) {
  // search for network and launch gateway, if found
  let ecosystem
  for (var key in scripts) {
    if (
      key.indexOf(':') > -1 &&
      key.toLowerCase() === process.argv[2].toLowerCase()
    ) {
      if (process.env.ETHRPC_SEED_PHRASE || process.env.ETHRPC_PRIVATE_KEYS) {
        var cmdline = scripts[key].split(' ')
        // substitute "node path/to/bin" to "npx ethrpc-bin"
        var index = cmdline.findIndex(item => item === 'node')
        if (index > -1) cmdline[index] = 'npx'
        index = cmdline.findIndex(item => item.startsWith('dist/bin'))
        if (index > -1)
          cmdline[index] = `ethrpc-${cmdline[index].split('/').slice(-1)}`
        // replace all references to $ETHRPC_PROVIDER_URL
        cmdline = cmdline.map(item => {
          if (item.indexOf('$ETHRPC_PROVIDER_KEY') > -1) {
            if (!process.env.ETHRPC_PROVIDER_KEY) {
              console.info()
              console.info(
                'Cannot launch',
                key,
                'gateway: the ETHRPC_PROVIDER_KEY envar must be set!'
              )
              process.exit(0)
            }
            return item.replaceAll(
              '$ETHRPC_PROVIDER_KEY',
              process.env.ETHRPC_PROVIDER_KEY
            )
          } else {
            return item
          }
        })
        if (process.argv.length >= 4) {
          // a specific JSONRPC provider has been specified in the command line:
          cmdline[cmdline.length - 2] = process.argv[3]
          if (process.env.ETHRPC_PORT) {
            cmdline[cmdline.length - 1] = process.env.ETHRPC_PORT
          }
          // invoke subprocess
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(4).join(' ')),
            { stdio: 'inherit' }
          )
        } else if (process.env.ETHRPC_PROVIDER_URL) {
          // the ETHRPC_PROVIDER_URL variable is set
          cmdline[cmdline.length - 2] = process.env.ETHRPC_PROVIDER_URL
          if (process.env.ETHRPC_PORT) {
            cmdline[cmdline.length - 1] = process.env.ETHRPC_PORT
          }
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(3).join(' ')),
            { stdio: 'inherit' }
          )
        } else if (process.env.ETHRPC_PORT) {
          // the ETHRPC_PORT variable is set while ETHRPC_PROVIDER_URL is not
          cmdline[cmdline.length - 1] = process.env.ETHRPC_PORT
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(3).join(' ')),
            { stdio: 'inherit' }
          )
        } else {
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(3).join(' ')),
            { stdio: 'inherit' }
          )
        }
        process.exit(0)
      } else {
        console.info()
        console.info(
          '\x1b[1;37mCannot launch gateway on\x1b[1;32m',
          key,
          '\x1b[1;37m!!\x1b[0m'
        )
        console.info(
          '\nPlease, setup the \x1b[33mETHRPC_PRIVATE_KEYS\x1b[0m environment variable, or add it to the .env file!\n'
        )
        process.exit(0)
      }
    } else if (
      key.indexOf(':') &&
      key.split(':')[0].toLowerCase() === process.argv[2].toLowerCase()
    ) {
      ecosystem = process.argv[2].toLowerCase()
      break
    }
  }
  // if parameter matched a known ecosystem, list available network within it
  if (ecosystem) {
    const header = `SUPPORTED NETWORKS IN '${ecosystem.toUpperCase()}'`
    console.info('\x1b[1;37m')
    console.info(header)
    console.info('='.repeat(header.length), '\x1b[0m')
    for (var key in scripts) {
      if (key.split(':')[0].toLowerCase() === ecosystem) {
        console.info('  ', `\x1b[1;32m${key}\x1b[0m`)
      }
    }
    process.exit(0)
  } else {
    if (process.argv[2].indexOf(':') > -1) {
      console.info(
        `\n\x1b[1;37mUnknown network: \x1b[1;31m${process.argv[2].toUpperCase()}\x1b[0m`
      )
    } else {
      console.info(
        `\n\x1b[1;37mUnknown ecosystem: \x1b[1;31m${process.argv[2].toUpperCase()}\x1b[0m`
      )
    }
  }
}
console.info('\n\x1b[1;37mUsage:\x1b[0m')
console.info()
console.info(
  '  \x1b[1;37m',
  '$ npx ethrpc',
  '\x1b[1;33m[<ecosystem>[:<network>] [custom-rpc-provider-url]]',
  '\x1b[0m'
)
if (!process.env.ETHRPC_SEED_PHRASE) {
  console.info()
  console.info(
    'At least one of the following env variables must be previously set (or included within an .env file):'
  )
  console.info()
  console.info(
    '  ',
    '\x1b[33mETHRPC_PRIVATE_KEYS\x1b[0m',
    '\t=>',
    'An array of one or more private keys from which wallet addresses will be derived.'
  )
  console.info(
    '  ',
    '\x1b[33mETHRPC_SEED_PHRASE\x1b[0m',
    '\t=>',
    'Secret phrase from which wallet addresses will be derived.'
  )
}
if (!process.env.ETHRPC_PROVIDER_URL) {
  console.info()
  console.info('Optionally, you can specify a custom endpoint by setting:')
  console.info()
  console.info(
    '  ',
    '\x1b[33mETHRPC_PROVIDER_URL\x1b[0m',
    '\t=>',
    'The JSON ETH/RPC provider to connect to.'
  )
}

const ecosystems = []
for (var key in scripts) {
  if (key.indexOf(':') > -1) {
    const ecosystem = key.split(':')[0]
    if (!ecosystems.includes(ecosystem)) {
      ecosystems.push(ecosystem)
    }
  }
}
if (ecosystems.length > 0) {
  console.info('\x1b[1;37m')
  const header = 'SUPPORTED ECOSYSTEMS'
  console.info(header)
  console.info('='.repeat(header.length), '\x1b[0m')
  for (var index in ecosystems) {
    console.info('  ', `\x1b[1;32m${ecosystems[index]}\x1b[0m`)
  }
}
