const express = require('express')

const driver = require('../neo4j_driver.js')
const auth = require('../auth.js')

const controller = require('../controllers/approvals.js')

const router = express.Router()

router.use(auth.check_auth)

router.route('/:approval_id/attachment_hankos')
  .put(controller.update_attachment_hankos)




module.exports = router
