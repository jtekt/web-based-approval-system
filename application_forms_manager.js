const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const {version, author, name: application_name} = require('./package.json')

dotenv.config()

console.log(`- Application form manager v${version} -`)

process.env.TZ = process.env.TZ || 'Asia/Tokyo'

const port = process.env.APP_PORT || 80

const app = express()

app.use(bodyParser.json())
app.use(cors())
app.use(apiMetrics())

app.get('/', (req, res) => {
  res.send({
    application_name,
    author,
    version,
    neo4j_url: process.env.NEO4J_URL,
    authentication_api_url: process.env.AUTHENTICATION_API_URL,
  })
})

app.use('/', require('./routes/v1/index.js'))
app.use('/v2', require('./routes/v2/index.js'))

app.listen(port, () => console.log(`[Express] listening on port ${port}`))
