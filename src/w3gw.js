#!/usr/bin/env node

const execSync = require('child_process').execSync;
const scripts = require('../package.json').scripts;

if (process.argv.length >= 3) {
    for (const key in scripts) {
        if (key === process.argv[2]) {

            process.exit(0)
        }
    }
} 
console.info("Usage:")
console.info()
console.info("  ", `$ ${process.argv[0]} ${process.argv[1]} <ecosystem>:<network>`)
console.info()
console.info("Supported values:")
console.info()
for (const key in scripts) {
    if (key.indexOf(":") > -1) {
        console.info("  ", "  ", key)
    }
}
console.info()
console.info("The following environment variables must be set:")
console.info()
console.info("  ", "SEED_PHRASE", "\t=>", "Secret phrase from which wallet addresses will be derived.")
console.info("  ", "NUM_WALLETS", "\t=>", "Number of wallet addresses to derive from given seed phrase (default: 3).")
