const express = require('express')

const driver = require('../neo4j_driver.js')
const auth = require('../auth.js')

const controller = require('../controllers/decisions.js')

const router = express.Router()

router.use(auth.check_auth)

router.route('/:decision_id/comment')
  .put(controller.update_comment)


module.exports = router
