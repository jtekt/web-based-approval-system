const express = require('express')

const {get_applications} = require('../../controllers/v3/applications.js')

const router = express.Router()

router.route('/')
  .get(get_applications)

module.exports = router
