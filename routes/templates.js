const { Router } = require("express")
const {
  create_template,
  read_templates,
  read_template,
  update_template,
  delete_template,
  add_template_manager,
} = require("../controllers/templates.js")

const router = Router()

router.route("/").post(create_template).get(read_templates)

router
  .route("/:template_id")
  .get(read_template)
  .put(update_template)
  .patch(update_template)
  .delete(delete_template)

router.route("/:template_id/managers").post(add_template_manager)

module.exports = router
