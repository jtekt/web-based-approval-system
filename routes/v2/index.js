const {Router} = require('express')



const router = Router()

router.use('/applications', require('./applications.js'))


module.exports = router
