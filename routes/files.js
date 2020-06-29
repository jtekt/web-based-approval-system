
const express = require('express')

const auth = require('../auth.js')

const router = express.Router()


const controller = require('../controllers/files.js')

router.use(auth.check_auth)
router.route('/')
  .post(controller.file_upload)

router.route('/:file_id')
  .get(controller.get_file)

module.exports = router
