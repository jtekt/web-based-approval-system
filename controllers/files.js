const createHttpError = require("http-errors")
const mv = require("mv")
const fs = require("fs")
const path = require("path")
const formidable = require("formidable")
const { v4: uuidv4 } = require("uuid")
const { driver } = require("../db.js")
const { get_current_user_id } = require("../utils.js")
const { uploads_path } = require("../config")

const parse_form = (req) =>
  new Promise((resolve, reject) => {
    // Parse multipart/form-data
    const form = new formidable.IncomingForm()
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      resolve(files)
    })
  })

const store_file = (file_to_upload) =>
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

const get_dir_files = (directory_path, file_id) =>
  new Promise((resolve, reject) => {
    // Read files of a directory
    fs.readdir(directory_path, (err, items) => {
      if (err) reject(err)
      resolve(items)
    })
  })

exports.file_upload = async (req, res) => {
  // Upload an attachment

  try {
    const { file_to_upload } = await parse_form(req)
    if (!file_to_upload) throw createHttpError(400, "Missing file")
    const file_id = await store_file(file_to_upload)
    console.log(`File ${file_id} uploaded`)
    res.send({ file_id })
  } catch (error) {
    next(error)
  }
}

exports.get_file = async (req, res) => {
  const session = driver.session()

  try {
    const { file_id } = req.params
    const user_id = get_current_user_id(res)
    const { application_id } = req.params

    if (!file_id) throw createHttpError(400, "File ID not specified")
    if (!application_id)
      throw createHttpError(400, "Application ID not specified")

    const query = `
    // Find current user to check for authorization
    MATCH (user:User {_id: $user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm {_id: $application_id})

    // Enforce privacy
    WITH user, application
    WHERE NOT application.private
      OR NOT EXISTS(application.private)
      OR (application)-[:SUBMITTED_BY]->(user)
      OR (application)-[:SUBMITTED_TO]->(user)
      OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)

    return application
    `

    const params = { user_id, file_id, application_id }

    const { records } = await session.run(query, params)

    // Check if the application exists (i.e. can be seen by the user)
    if (!records.length)
      throw createHttpError(
        400,
        `Application ${application_id} could not be queried`
      )

    // Check if the application has a file with the given ID
    const application_node = records[0].get("application")
    const form_data = JSON.parse(application_node.properties.form_data)
    const found_file = form_data.find(({ value }) => value === file_id)
    if (!found_file)
      throw createHttpError(
        400,
        `Application ${application_id} does not include the file ${file_id}`
      )

    // Now download the file
    const directory_path = path.join(uploads_path, file_id)
    const files = await get_dir_files(directory_path, file_id)

    const file_to_download = files[0]
    if (!file_to_download) throw createHttpError(500, `Could not open file`)
    console.log(
      `File ${file_id} of application ${application_id} downloaded by user ${user_id}`
    )

    // NOTE: Why not sendFile?
    res.download(path.join(directory_path, file_to_download), file_to_download)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.get_file_name = async (req, res) => {
  // Used by GET /applications/:application_id/files/:file_id/filename'

  const { file_id } = req.params

  if (!file_id) return next(createError(400, `File ID not specified`))

  // Now download the file
  const directory_path = path.join(uploads_path, file_id)
  const files = await get_dir_files(directory_path, file_id)
  const filename = files[0]
  res.send({ filename })
}
