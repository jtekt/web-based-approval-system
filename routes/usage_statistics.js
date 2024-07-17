const { Router } = require("express")
const { get_groups_usage } = require("../controllers/usage_statistics.js")

const router = Router()

router.route("/groups").get(get_groups_usage)

module.exports = router
