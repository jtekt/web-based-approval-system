const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')

// Local imports
var driver = require('./neo4j_driver.js')
var auth = require('./auth.js')
var application_router = require('./application_router.js')
var applications_router = require('./applications_router.js')
var template_router = require('./template_router.js')
var file_router = require('./file_router.js')

dotenv.config()


const port = process.env.APP_PORT || 80

process.env.TZ = 'Asia/Tokyo'

const app = express()

app.use(bodyParser.json())
app.use(cors())

app.get('/', (req,res) => { res.send('Shinsei manager API, Maxime MOREILLON')})

// Application management
// Todo: combine if possible
app.use('/application', application_router)
app.use('/applications', applications_router)

// Template management
app.use('/application_form_template', template_router)

// File related routes
app.use('/file', file_router)


// Start the server
app.listen(port, () => console.log(`Application form manager listening on 0.0.0.0:${port}`))
