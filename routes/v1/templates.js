const {Router} = require('express')
const {
  create_application_form_template,
  get_all_application_form_templates_visible_to_user,
  get_application_form_template,
  edit_application_form_template,
  delete_application_form_template
} = require('../../controllers/v1/templates.js')

const router = Router()


router.route('/')
  .post(create_application_form_template)
  .get(get_all_application_form_templates_visible_to_user)

router.route('/:template_id')
  .get(get_application_form_template)
  .put(edit_application_form_template)
  .delete(delete_application_form_template)



module.exports = router
