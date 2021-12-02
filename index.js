const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const {
  version,
  author,
  name: application_name
} = require('./package.json')

dotenv.config()

console.log(`- Application form manager v${version} -`)

// Reading environment variables
const {
  APP_PORT = 80,
  NEO4J_URL: neo4j_url = 'bolt://neo4j:7687',
  AUTHENTICATION_API_URL: authentication_api_url = 'http://authentication',
} = process.env

process.env.TZ = process.env.TZ || 'Asia/Tokyo'

const app = express()

app.use(bodyParser.json())
app.use(cors())
app.use(apiMetrics())

app.get('/', (req, res) => {
  res.send({
    application_name,
    author,
    version,
    neo4j_url,
    authentication_api_url,
  })
})

app.use('/', require('./routes/v1/index.js'))
app.use('/v2', require('./routes/v2/index.js'))
app.use('/v2', require('./routes/v3/index.js'))

app.listen(APP_PORT, () => console.log(`[Express] listening on port ${APP_PORT}`))

// Exporting app for tests
exports.app = app
