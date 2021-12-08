const {Router} = require('express')

const controller = require('../../controllers/v1/approvals.js')

const router = Router()

router.route('/:approval_id/attachment_hankos')
  .put(controller.update_attachment_hankos)




module.exports = router
