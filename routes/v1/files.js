const {Router} = require('express')
const controller = require('../../controllers/v1/files.js')

const router = Router()

router.route('/')
  .post(controller.file_upload)

router.route('/:file_id')
  .get(controller.get_file)

module.exports = router
