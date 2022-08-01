const {Router} = require('express')



const router = Router()

router.use('/applications', require('./applications.js'))

router.use('/application_form_templates', require('./templates.js'))
router.use('/templates', require('./templates.js')) // alias

router.use('/files', require('./files.js'))



module.exports = router
