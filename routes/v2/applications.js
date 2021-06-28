const express = require('express')
const auth = require('../../auth.js')
const controller = require('../../controllers/v2/applications.js')

const router = express.Router()

router.use(auth.check_auth)


router.route('/submitted/pending')
  .get(controller.get_submitted_applications_pending)

router.route('/:application_id')
  .get(controller.get_application)



module.exports = router
