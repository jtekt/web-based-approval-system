const express = require('express')
const applications_router = require('./applications.js')
const router = express.Router()


router.use('/applications',applications_router)

module.exports = router
