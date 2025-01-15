const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf } = format

require('dotenv').config()

export interface SocketParams {
  clientAddr: string
  clientPort: number
  clientId: number
  serverId: number
}

type LogMessage = {
  level: string
  message: string
  socket: SocketParams
  timestamp: string
}

export function zeroPad (num: number, places: number) {
  return String(num).padStart(places, '0')
}

const logFormat = printf(
  ({ level, message, socket, timestamp }: LogMessage) => {
    return `${timestamp} [${socket.clientAddr}:${socket.clientPort}::${zeroPad(
      socket.serverId,
      4
    )}][${level}] ${message}`
  }
)

export const logger = createLogger({
  level: process.env.ETHRPC_LOG_LEVEL || 'verbose',
  format: combine(timestamp(), logFormat),
  transports: [new transports.Console()]
})

export function traceKeyValue (header: string, keys: any[][]) {
  console.log(header)
  console.log('-'.repeat(80))
  keys.forEach((pair: any[]) => {
    if (pair[0]) console.log(`${pair[0]}:\t${pair[1]}`)
    else console.log(pair[1])
  })
  console.log()
}
