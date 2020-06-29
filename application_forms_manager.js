const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

process.env.TZ = 'Asia/Tokyo'

const port = process.env.APP_PORT || 80

const app = express()

app.use(bodyParser.json())
app.use(cors())

app.get('/', (req,res) => { res.send('Shinsei manager API, Maxime MOREILLON')})

app.use('/applications', require('./routes/applications.js'))
app.use('/application_form_templates', require('./routes/templates.js'))
app.use('/files', require('./routes/files.js'))

app.listen(port, () => console.log(`Application form manager listening on port ${port}`))
