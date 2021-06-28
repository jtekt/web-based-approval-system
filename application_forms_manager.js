const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const pjson = require('./package.json')
const apiMetrics = require('prometheus-api-metrics')

dotenv.config()

process.env.TZ = 'Asia/Tokyo'

const port = process.env.APP_PORT || 80

const app = express()

app.use(bodyParser.json())
app.use(cors())
app.use(apiMetrics())


app.get('/', (req, res) => {
  res.send({
    application_name: 'Shinsei Manager API',
    author: 'Maxime MOREILLON',
    version: pjson.version,
    neo4j_url: process.env.NEO4J_URL,
    authentication_api_url: process.env.AUTHENTICATION_API_URL,
  })
})

app.use('/', require('./routes/v1/index.js'))
app.use('/v2', require('./routes/v2/index.js'))

app.listen(port, () => console.log(`Application form manager listening on port ${port}`))
