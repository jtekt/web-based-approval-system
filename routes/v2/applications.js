// Router for single application

const {Router} = require('express')
const {
  create_application,
  read_applications,
} = require('../../controllers/v2/applications.js')

const router = Router({mergeParams: true})


router.route('/')
  .post(create_application)
  .get(read_applications)

router.use('/:application_id', require('./application'))



module.exports = router
