const createHttpError = require("http-errors")

const formidable = require("formidable")
const { driver } = require("../db")
const { get_current_user_id } = require("../utils")
const { s3Client, store_file_on_s3, download_file_from_s3 } = require("../s3")
const {
  store_file_locally,
  download_file_from_local_folder,
} = require("../localFilesHandling")

const parse_form = (req) =>
  new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm()
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      resolve(files)
    })
  })

exports.file_upload = async (req, res, next) => {
  // Upload an attachment

  try {
    const { file_to_upload } = await parse_form(req)
    if (!file_to_upload) throw createHttpError(400, "Missing file")

    let file_id
    if (s3Client) file_id = await store_file_on_s3(file_to_upload)
    else file_id = await store_file_locally(file_to_upload)

    res.send({ file_id })
  } catch (error) {
    next(error)
  }
}

exports.get_file = async (req, res, next) => {
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
    WHERE application.private IS NULL
      OR NOT application.private
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
    if (s3Client) await download_file_from_s3(res, file_id)
    else await download_file_from_local_folder(res, file_id)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
