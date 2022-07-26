// Router for single application

const {Router} = require('express')
const {
  read_application
} = require('../../controllers/v2/applications.js')

const router = Router({mergeParams: true})


router.route('/')
  .get(read_application)



module.exports = router
