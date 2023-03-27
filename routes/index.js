const { Router } = require("express")
const applicationsController = require("./applications.js")
const templatesController = require("./templates.js")
const filesController = require("./files.js")

const router = Router()

router.use("/applications", applicationsController)

router.use("/application_form_templates", templatesController)
router.use("/templates", templatesController) // alias

router.use("/files", filesController)

module.exports = router
