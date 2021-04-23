const express = require('express')

const applications_router = require('./applications.js')
const approvals_router = require('./approvals.js')
const decisions_router = require('./decisions.js')
const files_router = require('./files.js')
const templates_router = require('./templates.js')

const router = express.Router()

router.use('/applications', applications_router)
router.use('/approvals', approvals_router)
router.use('/decisions', decisions_router)
router.use('/files', files_router)
router.use('/templates', templates_router)

module.exports = router
