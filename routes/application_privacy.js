const { Router } = require("express")
const {
  update_application_privacy,
  make_application_visible_to_group,
  remove_application_visibility_to_group,
} = require("../controllers/application_privacy.js")

const router = Router({ mergeParams: true })

router.route("/").put(update_application_privacy)

router.route("/groups").post(make_application_visible_to_group)

router.route("/groups/:group_id").delete(remove_application_visibility_to_group)

module.exports = router
