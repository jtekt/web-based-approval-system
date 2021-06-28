const express = require('express')
const auth = require('../../auth.js')
const controller = require('../../controllers/v1/files.js')

const router = express.Router()

router.use(auth.check_auth)

router.route('/')
  .post(controller.file_upload)

router.route('/:file_id')
  .get(controller.get_file)

module.exports = router
