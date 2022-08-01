const dotenv = require('dotenv')
dotenv.config()

const {
    UPLOADS_PATH = "/usr/share/pv"
} = process.env

exports.uploads_path = UPLOADS_PATH