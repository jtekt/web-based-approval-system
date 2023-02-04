const { Router } = require("express")
const {
  file_upload,
  get_unused_files,
  move_unused_files,
  get_file,
  get_file_name,
} = require("../../controllers/v2/files.js")

const router = Router({ mergeParams: true })

router.route("/").post(file_upload)

router.route("/:file_id").get(get_file)

router.route("/:file_id/filename").get(get_file_name)

// router.route('/unused')
//   .get(get_unused_files)
//   .delete(move_unused_files)

module.exports = router
