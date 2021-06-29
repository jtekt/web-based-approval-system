const express = require('express')
const applications_router = require('./applications.js')
const auth = require('../../auth.js')

const router = express.Router()

router.use(auth.check_auth)

router.use('/applications',applications_router)

module.exports = router
