const express = require('express')
const auth = require('../../auth.js')
const controller = require('../../controllers/v2/files.js')

const router = express.Router()


router.route('/unused')
  .get(controller.get_unused_files)
  .delete(controller.move_unused_files)


module.exports = router
