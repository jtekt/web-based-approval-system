const { Router } = require("express")
const { file_upload, get_file } = require("../controllers/files.js")

const router = Router({ mergeParams: true })

router.route("/").post(file_upload)

router.route("/:file_id").get(get_file)

module.exports = router
