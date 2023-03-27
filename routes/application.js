const { Router } = require("express")
const { update_comment } = require("../controllers/recipient_comment")
const {
  read_application,
  delete_application,
  approve_application,
  reject_application,
} = require("../controllers/applications")

const router = Router({ mergeParams: true })

router.route("/").get(read_application).delete(delete_application)

router.route("/approve").post(approve_application)
router.route("/reject").post(reject_application)

// TODO: consider grouping with notifications
router.route("/comment").put(update_comment)

router.use("/privacy", require("./application_privacy"))
router.use("/files", require("./files"))
router.use("/hankos", require("./hankos"))
router.use(
  "/recipients/:recipient_id/notifications",
  require("./notifications")
)

module.exports = router
