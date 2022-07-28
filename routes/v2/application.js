// Router for single application

const {Router} = require('express')
const {
  read_application,
  delete_application,
  approve_application,
  reject_application
} = require('../../controllers/v2/applications.js')

const router = Router({mergeParams: true})


router.route('/')
  .get(read_application)
  .delete(delete_application)

router.route('/approve').post(approve_application)
router.route('/reject').post(reject_application)

module.exports = router
