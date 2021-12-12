const {Router} = require('express')
const application_router = require('./application.js')
const {
  create_application,
  get_application_types,
  get_applications,
} = require('../../controllers/v1/applications.js')


const router = Router()

router.route('/')
  .post(create_application)
  .get(get_applications)

router.route('/types')
  .get(get_application_types)

router.use('/:application_id', application_router)



module.exports = router
