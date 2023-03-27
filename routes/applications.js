const { Router } = require("express")
const singleApplicationRouter = require("./application")
const {
  create_application,
  read_applications,
  get_application_types,
} = require("../controllers/applications.js")

const router = Router({ mergeParams: true })

router.route("/").post(create_application).get(read_applications)

router.route("/types").get(get_application_types)

router.use("/:application_id", singleApplicationRouter)

module.exports = router
