const express = require('express')
const auth = require('../../auth.js')
const applications_router = require('./applications.js')


const router = express.Router()

router.use(auth.check_auth)

router.use('/applications',applications_router)

module.exports = router
