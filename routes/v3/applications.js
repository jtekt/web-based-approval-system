const express = require('express')
const auth = require('../../auth.js')

const submitted_applications_router = require('./submitted_applications.js')
const received_applications_router = require('./received_applications.js')

const router = express.Router()

router.use('/submitted',submitted_applications_router)
router.use('/received',received_applications_router)




module.exports = router
