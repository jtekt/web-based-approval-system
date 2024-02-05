const mv = require("mv")
const fs = require("fs")
const path = require("path")
const { uploads_path } = require("./config")
const { v4: uuidv4 } = require("uuid")

exports.store_file_locally = (file_to_upload) =>
  new Promise((resolve, reject) => {
    // Store file in the uploads directory

    const { path: old_path, name: file_name } = file_to_upload

    const file_id = uuidv4()
    const new_directory_path = path.join(uploads_path, file_id)
    const new_file_path = path.join(new_directory_path, file_name)

    mv(old_path, new_file_path, { mkdirp: true }, (err) => {
      if (err) reject(err)
      resolve(file_id)
    })
  })

exports.download_file_from_local_folder = async (res, file_id) => {
  const directory_path = path.join(uploads_path, file_id)
  const files = fs.readdirSync(directory_path)

  const file_to_download = files[0]
  if (!file_to_download) throw createHttpError(500, `Could not open file`)

  // NOTE: Not using sendfile because specifying file name
  res.download(path.join(directory_path, file_to_download), file_to_download)
}
