const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')

// Local imports
var driver = require('./neo4j_driver.js')
var auth = require('./auth.js')
var application_management = require('./application_management.js')
var template_management = require('./template_management.js')
var file_management = require('./file_management.js')

dotenv.config();


var port = 80
if(process.env.APP_PORT) port=process.env.APP_PORT

process.env.TZ = 'Asia/Tokyo'

const app = express()

app.use(bodyParser.json())
app.use(cors())

// Application management
app.get('/application',auth.check_auth, application_management.get_application)
app.get('/application/applicant',auth.check_auth, application_management.get_application_applicant)
app.get('/application/recipients',auth.check_auth, application_management.get_application_recipients)
app.get('/application/visibility',auth.check_auth, application_management.get_application_visibility)

app.get('/submitted_applications',auth.check_auth, application_management.get_submitted_applications)
app.get('/submitted_applications/pending',auth.check_auth, application_management.get_submitted_applications_pending)
app.get('/submitted_applications/approved',auth.check_auth, application_management.get_submitted_applications_approved)
app.get('/submitted_applications/rejected',auth.check_auth, application_management.get_submitted_applications_rejected)

app.get('/received_applications',auth.check_auth, application_management.get_received_applications)
app.get('/received_applications/pending',auth.check_auth, application_management.get_received_applications_pending)
app.get('/received_applications/approved',auth.check_auth, application_management.get_received_applications_approved)
app.get('/received_applications/rejected',auth.check_auth, application_management.get_received_applications_rejected)

app.post('/application', auth.check_auth, application_management.create_application)
app.post('/create_application', auth.check_auth, application_management.create_application) // Route alias for legacy support

app.delete('/application',auth.check_auth, application_management.delete_application)
app.delete('/delete_application',auth.check_auth, application_management.delete_application) // Route alias for legacy support
app.post('/delete_application',auth.check_auth, application_management.delete_application)// Route alias for legacy support

app.post('/approve_application',auth.check_auth, application_management.approve_application)
app.post('/reject_application',auth.check_auth, application_management.reject_application)

app.put('/privacy_of_application', auth.check_auth, application_management.update_privacy_of_application)
app.post('/update_privacy_of_application', auth.check_auth, application_management.update_privacy_of_application) // Route alias for legacy support

app.put('/application_visibility', auth.check_auth, application_management.update_application_visibility) // Route alias for legacy support
app.post('/update_application_visibility', auth.check_auth, application_management.update_application_visibility) // Route alias for legacy support

app.post('/make_application_visible_to_group', auth.check_auth, application_management.make_application_visible_to_group) // Not sure if  used anymore
app.post('/remove_application_visibility_to_group', auth.check_auth, application_management.remove_application_visibility_to_group) // Not sure if  used anymore

app.post('/find_application_id_by_hanko',auth.check_auth, application_management.find_application_id_by_hanko)


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
