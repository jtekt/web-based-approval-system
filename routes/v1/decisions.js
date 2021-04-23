const express = require('express')
const auth = require('../../auth.js')

const controller = require('../../controllers/v1/decisions.js')

const router = express.Router()

router.use(auth.check_auth)

router.route('/:decision_id/comment')
  .put(controller.update_comment)


module.exports = router
