// /applications/:id/hankos
const { Router } = require("express")
const { update_hankos } = require("../controllers/hankos")

const router = Router({ mergeParams: true })

router.route("/").put(update_hankos)

module.exports = router
