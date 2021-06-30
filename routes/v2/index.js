const express = require('express')
const auth = require('../../auth.js')
const applications_router = require('./applications.js')
const files_router = require('./files.js')


const router = express.Router()

router.use(auth.check_auth)

router.use('/applications',applications_router)
router.use('/files',files_router)

module.exports = router
