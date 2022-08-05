const { Router } = require('express')
const {
    update_hankos
} = require('../../controllers/v2/hankos')

const router = Router({ mergeParams: true })


router.route('/')
    .put(update_hankos)


module.exports = router
