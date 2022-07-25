// Router for single application

const {Router} = require('express')
const {
  read_applications
} = require('../../controllers/v2/applications.js')

const router = Router({mergeParams: true})


router.route('/')
  .get(read_applications)



module.exports = router
