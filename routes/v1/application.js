// Router for single application

const {Router} = require('express')
const controller = require('../../controllers/v1/applications.js')
const file_controller = require('../../controllers/v1/files.js')

const router = Router({mergeParams: true})


router.route('/')
  .get(controller.get_application)
  .delete(controller.delete_application)

router.route('/approve')
  .post(controller.approve_application)

router.route('/reject')
  .post(controller.reject_application)

router.route('/privacy')
  .put(controller.update_privacy_of_application)

// why the difference with below??
router.route('/visibility')
  .put(controller.update_application_visibility)

// Route not very RESTful
router.route('/visibility_to_group')
  .post(controller.make_application_visible_to_group)
  .delete(controller.remove_application_visibility_to_group)

router.route('/files/:file_id')
  .get(file_controller.get_file)




module.exports = router
