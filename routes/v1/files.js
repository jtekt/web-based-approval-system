const {Router} = require('express')
const {
  file_upload,
  get_unused_files,
  move_unused_files,
} = require('../../controllers/v1/files.js')

const router = Router()

router.route('/')
  .post(file_upload)

router.route('/unused')
  .get(get_unused_files)
  .delete(move_unused_files)

module.exports = router
