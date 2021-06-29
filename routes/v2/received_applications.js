const express = require('express')

const controller = require('../../controllers/v2/applications.js')

const router = express.Router()


router.route('/pending').get(controller.get_received_pending_applications)
router.route('/rejected').get(controller.get_received_rejected_applications)
router.route('/approved').get(controller.get_received_approved_applications)

router.route('/pending/count').get(controller.get_received_pending_applications_count)
router.route('/rejected/count').get(controller.get_received_rejected_applications_count)
router.route('/approved/count').get(controller.get_received_approved_applications_count)



module.exports = router
