const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const { version, author } = require('./package.json')
const {
  middleware: authentication_middleware,
  url: authentication_url
} = require('./auth.js')
const {
  url: neo4j_url,
  get_connected: get_neo4j_connection_status,
  init: db_init,
} = require('./db.js')

dotenv.config()

console.log(`Shinsei manager v${version}`)

db_init()

// Reading environment variables
const { APP_PORT = 80 } = process.env

process.env.TZ = process.env.TZ || 'Asia/Tokyo'

const app = express()

app.use(express.json())
app.use(cors())
app.use(apiMetrics())


app.get('/', (req, res) => {
  res.send({
    application_name: 'Shinsei-manager',
    author,
    version,
    neo4j: {
      url: neo4j_url,
      connected: get_neo4j_connection_status()
    },
    authentication_url,
  })
})

app.use(authentication_middleware)

app.use('/', require('./routes/v1/index.js'))
app.use('/v1', require('./routes/v1/index.js'))

// error handling
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.statusCode).send(err.message)
})

app.listen(APP_PORT, () => console.log(`[Express] listening on port ${APP_PORT}`))

exports.app = app // Exporting app for tests
