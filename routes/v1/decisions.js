const {Router} = require('express')
const controller = require('../../controllers/v1/decisions.js')

const router = Router()

router.route('/:decision_id/comment')
  .put(controller.update_comment)


module.exports = router
