const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const { url: neo4j_url } = require('./db.js')
const { version, author } = require('./package.json')
const {
  middleware: authentication_middleware,
  url: authentication_url
} = require('./auth.js')

dotenv.config()

console.log(`- Application form manager v${version} -`)

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
    neo4j_url,
    authentication_url,
  })
})

app.use(authentication_middleware)

app.use('/', require('./routes/v1/index.js'))
app.use('/v2', require('./routes/v2/index.js'))
app.use('/v3', require('./routes/v3/index.js'))

app.listen(APP_PORT, () => console.log(`[Express] listening on port ${APP_PORT}`))

exports.app = app // Exporting app for tests
