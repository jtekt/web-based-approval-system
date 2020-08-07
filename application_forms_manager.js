const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const pjson = require('./package.json')

dotenv.config()

process.env.TZ = 'Asia/Tokyo'

const port = process.env.APP_PORT || 80

const app = express()

app.use(bodyParser.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({
    application_name: 'Shinsei Manager API',
    author: 'Maxime MOREILLON',
    version: pjson.version,
    neo4j_url: process.env.NEO4J_URL,
    authentication_api_url: process.env.AUTHENTICATION_API_URL,
  })
})
app.use('/applications', require('./routes/applications.js'))
app.use('/application_form_templates', require('./routes/templates.js'))
app.use('/files', require('./routes/files.js'))

app.listen(port, () => console.log(`Application form manager listening on port ${port}`))
