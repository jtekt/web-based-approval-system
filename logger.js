const { createLogger, transports, format } = require("winston")
const LokiTransport = require("winston-loki")
const dotenv = require("dotenv")

dotenv.config()

const { LOKI_URL } = process.env

const consoleTransport = new transports.Console({
  format: format.combine(format.simple(), format.colorize()),
})

// By default, only log to console
const loggerOptions = { transports: [consoleTransport] }

// If the Loki URL is provided, then also log to Loki
if (LOKI_URL) {
  console.log(`[Logger] LOKI_URL provided: ${LOKI_URL}`)

  const lokiTransport = new LokiTransport({
    host: LOKI_URL,
    labels: { app: "Shinsei manager" },
    json: true,
    format: format.json(),
    replaceTimestamp: true,
    onConnectionError: (err) => console.error(err),
  })

  loggerOptions.transports.push(lokiTransport)
}

const logger = createLogger(loggerOptions)

exports.loki_url = LOKI_URL
exports.logger = logger
