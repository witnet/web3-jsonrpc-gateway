#!/usr/bin/env node
require('dotenv').config()
const execSync = require('child_process').execSync
const scripts = require('../../package.json').scripts

if (process.argv.length >= 3) {
  // search for network and launch gateway, if found
  let ecosystem 
  for (var key in scripts) {
    if (key.indexOf(":") > -1 && key === process.argv[2]) {
      if (process.env.W3GW_SEED_PHRASE || process.env.W3GW_PRIVATE_KEYS) {
        var cmdline = scripts[key].split(' ')
        // substitute "node path/to/bin" to "npx w3gw-bin"
        var index = cmdline.findIndex(item => item === "node")
        if (index > -1) cmdline[index] = "npx"
        index = cmdline.findIndex(item => item.startsWith("dist/bin"))
        if (index > -1) cmdline[index] = `w3gw-${cmdline[index].split("/").slice(-1)}`
        if (process.argv.length >= 4) {
          // a specific JSONRPC provider has been specified in the command line:  
          cmdline[cmdline.length - 2] = process.argv[3]
          if (process.env.W3GW_PORT) {
            cmdline[cmdline.length - 1] = process.env.W3GW_PORT
          }
          // invoke subprocess
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(4).join(' ')),
            { stdio: 'inherit' }
          )
        } else if (process.env.W3GW_PROVIDER_URL) {
          // the W3GW_PROVIDER_URL variable is set
          cmdline[cmdline.length - 2] = process.env.W3GW_PROVIDER_URL
          if (process.env.W3GW_PORT) {
            cmdline[cmdline.length - 1] = process.env.W3GW_PORT
          }
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(3).join(' ')),
            { stdio: 'inherit' }
          )
        } else if (process.env.W3GW_PORT) {
          // the W3GW_PORT variable is set while W3GW_PROVIDER_URL is not
          cmdline[cmdline.length - 1] = process.env.W3GW_PORT
          execSync(
            'yarn '
              .concat(cmdline.join(' '), ' ')
              .concat(process.argv.slice(3).join(' ')),
            { stdio: 'inherit' }
          )
        } else {
          execSync(
            'yarn '
              .concat(
                scripts[key].replace(
                  '$W3GW_PROVIDER_KEY',
                  process.env.W3GW_PROVIDER_KEY
                ),
                ' '
              )
              .concat(process.argv.slice(3).join(' ')),
            { stdio: 'inherit' }
          )
        }
        process.exit(0)
      } else {
        console.info()
        console.info("Cannot launch", key, "gateway !!")
        console.info("Please, setup the W3GW_SEED_PHRASE environment variable, or add it to the .env file!")
        process.exit(1)
      }
    } else if (key.indexOf(":") && key.split(":")[0].toLowerCase() === process.argv[2].toLowerCase()) {
      ecosystem = process.argv[2].toLowerCase()
      break
    }
  }
  // if parameter matched a known ecosystem, list available network within it
  if (ecosystem) {
    const header = `AVAILABLE NETWORKS ON ${ecosystem.toUpperCase()}`
    console.info()
    console.info(header)
    console.info("=".repeat(header.length))
    for (var key in scripts) {
      if (key.split(":")[0].toLowerCase() === ecosystem) {
        console.info('  ', key)
      }
    }
    process.exit(0)
  }
}
console.info('Usage:')
console.info()
console.info(
  '  ',
  '$ '
    .concat(process.argv[0], ' ')
    .concat(process.argv[1], ' [<ecosystem>[:<network>] [custom-rpc-provider-url]]')
)
console.info()

const header = "AVAILABLE NETWORKS"
console.info("  ", header)
console.info("  ", "=".repeat(header.length))
console.info()
for (var key in scripts) {
  if (key.indexOf(':') > -1) {
    console.info('  ', '  ', key)
  }
}
console.info()
console.info(
  'The following environment variables must be previously set (or included within an .env file):'
)
console.info()
console.info(
  '  ',
  'W3GW_SEED_PHRASE',
  '\t=>',
  'Secret phrase from which wallet addresses will be derived.'
)
console.info()
console.info(
  'Optionally, you can specify a custom ETH/JSONRPC endpoint by setting:'
)
console.info()
console.info(
  '  ',
  'W3GW_PROVIDER_URL',
  '\t=>',
  'ETH/JSONRPC endpoint where to connect to.'
)
console.info()
