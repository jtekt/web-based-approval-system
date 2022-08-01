const {Router} = require('express')
const {
  create_template,
  read_templates,
  read_template,
  update_template,
  delete_template
} = require('../../controllers/v2/templates.js')

const router = Router()


router.route('/')
  .post(create_template)
  .get(read_templates)

router.route('/:template_id')
  .get(read_template)
  .put(update_template)
  .patch(update_template)
  .delete(delete_template)



module.exports = router
