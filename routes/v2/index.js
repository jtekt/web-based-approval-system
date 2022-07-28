const {Router} = require('express')



const router = Router()

router.use('/applications', require('./applications.js'))

router.use('/templates', require('./templates.js')) // alias



module.exports = router
