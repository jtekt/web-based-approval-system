const express = require('express')

const controller = require('../../controllers/v3/applications.js')

const router = express.Router()


router.route('/pending').get(controller.get_received_pending_applications)
router.route('/rejected').get(controller.get_received_rejected_applications)
router.route('/approved').get(controller.get_received_approved_applications)



module.exports = router
