// /applications/:id/hankos
const { Router } = require("express")
const { mark_recipient_as_notified } = require("../controllers/notifications")

const router = Router({ mergeParams: true })

router.route("/").post(mark_recipient_as_notified)

module.exports = router
