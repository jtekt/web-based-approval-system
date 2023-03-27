require("express-async-errors")
const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")
const apiMetrics = require("prometheus-api-metrics")
const auth = require("@moreillon/express_identification_middleware")
const { version, author } = require("./package.json")
const { loki_url } = require("./logger")
const {
  url: neo4j_url,
  get_connected: get_neo4j_connection_status,
  init: db_init,
} = require("./db")
const { uploads_path } = require("./config")
const router = require("./routes")

dotenv.config()

console.log(`Shinsei manager v${version}`)

db_init()

// Reading environment variables
const { APP_PORT = 80, IDENTIFICATION_URL, TZ } = process.env

process.env.TZ = TZ || "Asia/Tokyo"

const app = express()

app.use(express.json())
app.use(cors())
app.use(apiMetrics())

app.get("/", (req, res) => {
  res.send({
    application_name: "Shinsei-manager",
    author,
    version,
    neo4j: {
      url: neo4j_url,
      connected: get_neo4j_connection_status(),
    },
    identification: IDENTIFICATION_URL,
    uploads_path,
    loki_url,
  })
})

// Require authentication for all following routes
app.use(auth({ url: IDENTIFICATION_URL }))

app.use("/", router)
app.use("/v1", router) // Temporary alias
app.use("/v2", router) // Temporary alias

// error handling
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.statusCode || 500).send(err.message)
})

app.listen(APP_PORT, () =>
  console.log(`[Express] listening on port ${APP_PORT}`)
)

exports.app = app // Exporting app for tests
