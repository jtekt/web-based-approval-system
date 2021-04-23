const express = require('express')

const controller = require('../../controllers/v1/approvals.js')
const auth = require('../../auth.js')


const router = express.Router()

router.use(auth.check_auth)

router.route('/:approval_id/attachment_hankos')
  .put(controller.update_attachment_hankos)




module.exports = router
