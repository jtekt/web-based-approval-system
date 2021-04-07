const express = require('express')

const driver = require('../neo4j_driver.js')
const auth = require('../auth.js')

const controller = require('../controllers/applications.js')

const router = express.Router()

router.use(auth.check_auth)

router.route('/')
  .post(controller.create_application)

router.route('/count')
  .get(controller.get_application_count)

router.route('/types')
  .get(controller.get_application_types)

router.route('/submitted').get(controller.get_submitted_applications)
router.route('/submitted/pending').get(controller.get_submitted_applications_pending)
router.route('/submitted/approved').get(controller.get_submitted_applications_approved)
router.route('/submitted/rejected').get(controller.get_submitted_applications_rejected)

router.route('/received/').get(controller.get_received_applications)
router.route('/received/pending').get(controller.get_received_applications_pending)
router.route('/received/approved').get(controller.get_received_applications_approved)
router.route('/received/rejected').get(controller.get_received_applications_rejected)

router.route('/search')
  .get(controller.search_applications)

router.route('/:application_id')
  .get(controller.get_application)
  .delete(controller.delete_application)

router.route('/:application_id/approve')
  .post(controller.approve_application)
  .put(controller.approve_application)

router.route('/:application_id/reject')
  .post(controller.reject_application)
  .put(controller.reject_application)

router.route('/:application_id/privacy')
  .put(controller.update_privacy_of_application)

router.route('/:application_id/visibility')
  .get(controller.get_application_visibility) // MIGHT BE UNUSED
  .put(controller.update_application_visibility)

router.route('/:application_id/visibility_to_group')
  .post(controller.make_application_visible_to_group)
  .delete(controller.remove_application_visibility_to_group)

router.route('/:application_id/applicant')
  .get(controller.get_application_applicant) // MIGHT BE UNUSED

router.route('/:application_id/recipients')
  .get(controller.get_application_recipients) // MIGHT BE UNUSED

router.route('/:application_id/approvals/:approval_id')
  .put(controller.update_attachment_hankos)

router.route('/:application_id/files/:file_id')
  .get(require('../controllers/files.js').get_file)

module.exports = router
