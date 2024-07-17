const dotenv = require("dotenv")
dotenv.config()

const { version, author } = require("./package.json")
console.log(`Shinsei manager v${version}`)

const express = require("express")
require("express-async-errors")
const cors = require("cors")
const promBundle = require("express-prom-bundle")
const auth = require("@moreillon/express_identification_middleware")
const { loki_url } = require("./logger")
const {
  url: neo4j_url,
  get_connected: get_neo4j_connection_status,
  init: db_init,
} = require("./db")
const { S3_BUCKET, S3_REGION, S3_ENDPOINT } = require("./attachmentsStorage/s3")
const { UPLOADS_PATH } = require("./attachmentsStorage/local")

const router = require("./routes")
const statsRouter = require("./routes/usage_statistics")

db_init()

const { APP_PORT = 80, IDENTIFICATION_URL, TZ } = process.env
process.env.TZ = TZ || "Asia/Tokyo"
const corsOptions = {
  exposedHeaders: "Content-Disposition",
}
const promOptions = { includeMethod: true, includePath: true }

const app = express()

app.use(express.json())
app.use(cors(corsOptions))
app.use(promBundle(promOptions))

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
    attachments: {
      uploads_path: !S3_BUCKET ? UPLOADS_PATH : undefined,
      s3: S3_BUCKET
        ? {
            bucket: S3_BUCKET,
            region: S3_REGION,
            endpoint: S3_ENDPOINT,
          }
        : undefined,
    },

    loki_url,
  })
})

app.use("/stats", statsRouter)

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
