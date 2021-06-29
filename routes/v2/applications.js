const express = require('express')
const auth = require('../../auth.js')

const controller = require('../../controllers/v2/applications.js')
const submitted_applications_router = require('./submitted_applications.js')
const received_applications_router = require('./received_applications.js')

const router = express.Router()


router.use('/submitted',submitted_applications_router)
router.use('/received',received_applications_router)

router.route('/:application_id')
  .get(controller.get_application)



module.exports = router
