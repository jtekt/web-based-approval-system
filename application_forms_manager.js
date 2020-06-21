const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')

// Local imports
var driver = require('./neo4j_driver.js')
var auth = require('./auth.js')
var application_router = require('./application_router.js')
var applications_router = require('./applications_router.js')

var template_management = require('./template_management.js')
var file_management = require('./file_management.js')

dotenv.config();


const port = process.env.APP_PORT || 80

process.env.TZ = 'Asia/Tokyo'

const app = express()

app.use(bodyParser.json())
app.use(cors())

app.get('/', (req,res) => {
  res.send('Shinsei manager API, Maxime MOREILLON')
})

// Application management
app.use('/application', application_router)
app.use('/applications', applications_router)



// Templates management
app.post('/application_form_template', auth.check_auth, template_management.create_application_form_template)
app.post('/create_application_form_template', auth.check_auth, template_management.create_application_form_template) // Alias for legacy

app.put('/application_form_template', auth.check_auth, template_management.edit_application_form_template)
app.post('/edit_application_form_template', auth.check_auth, template_management.edit_application_form_template) // Alias for legacy

app.delete('/application_form_template', auth.check_auth, template_management.delete_application_form_template)
app.post('/delete_application_form_template', auth.check_auth, template_management.delete_application_form_template)

app.get('/all_application_form_templates_visible_to_user', auth.check_auth, template_management.get_all_application_form_templates_visible_to_user)
app.get('/application_form_templates_shared_with_user', auth.check_auth, template_management.get_application_form_templates_shared_with_user)
app.get('/application_form_templates_from_user', auth.check_auth, template_management.get_application_form_templates_from_user)

app.get('/application_form_template', auth.check_auth, template_management.get_application_form_template)
app.get('/application_form_template/visibility', auth.check_auth, template_management.get_application_form_template_visibility)


// File related routes
app.post('/file_upload',auth.check_auth, file_management.file_upload)
app.get('/file', auth.check_auth, file_management.get_file )


// Start the server
app.listen(port, () => console.log(`Application form manager listening on 0.0.0.0:${port}`))
