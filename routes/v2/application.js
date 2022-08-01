// Router for single application

const {Router} = require('express')
const {
  read_application,
  delete_application,
  approve_application,
  reject_application
} = require('../../controllers/v2/applications')
const {
  update_comment,
} = require('../../controllers/v2/recipient_comment')

const router = Router({mergeParams: true})


router.route('/')
  .get(read_application)
  .delete(delete_application)

router.route('/approve').post(approve_application)
router.route('/reject').post(reject_application)

router.route('/comment').put(update_comment)

router.use('/privacy', require('./application_privacy'))
router.use('/files', require('./files'))


module.exports = router
