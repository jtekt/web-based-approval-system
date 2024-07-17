const { Router } = require("express")
const {
  get_groups_usage,
  get_types_usage,
} = require("../controllers/usage_statistics.js")

const router = Router()

router.route("/groups").get(get_groups_usage)
router.route("/types").get(get_types_usage)

module.exports = router
