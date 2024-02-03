const createHttpError = require("http-errors")
const mv = require("mv")
const fs = require("fs")
const path = require("path")
const formidable = require("formidable")
const { v4: uuidv4 } = require("uuid")
const { driver } = require("../db.js")
const { get_current_user_id } = require("../utils.js")
const { uploads_path } = require("../config")
const {
  S3Client,
  PutObjectCommand,
  ListObjectsCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3")
const { addProxyToClient } = require("aws-sdk-v3-proxy")

const {
  S3_REGION,
  S3_ACCESS_KEY_ID = "",
  S3_SECRET_ACCESS_KEY = "",
  S3_ENDPOINT,
  S3_BUCKET = "",
  HTTPS_PROXY,
} = process.env

const s3ClientOptions = {
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  endpoint: S3_ENDPOINT,
}

const s3 = HTTPS_PROXY
  ? addProxyToClient(new S3Client(s3ClientOptions))
  : new S3Client(s3ClientOptions)

const parse_form = (req) =>
  new Promise((resolve, reject) => {
    // Parse multipart/form-data
    const form = new formidable.IncomingForm()
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      resolve(files)
    })
  })

const store_file_locally = (file_to_upload) =>
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

const store_file_on_s3 = async (file_to_upload) => {
  const file_id = uuidv4()
  const Key = `${file_id}/${file_to_upload.name}`
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Body: fs.readFileSync(file_to_upload.path),
    Key,
  })
  await s3.send(command)
  return file_id
}

const get_dir_files = (directory_path, file_id) =>
  new Promise((resolve, reject) => {
    // Read files of a directory
    fs.readdir(directory_path, (err, items) => {
      if (err) reject(err)
      resolve(items)
    })
  })

exports.file_upload = async (req, res, next) => {
  // Upload an attachment

  try {
    const { file_to_upload } = await parse_form(req)
    if (!file_to_upload) throw createHttpError(400, "Missing file")

    let file_id
    if (S3_BUCKET) file_id = await store_file_on_s3(file_to_upload)
    else file_id = await store_file_locally(file_to_upload)

    res.send({ file_id })
  } catch (error) {
    next(error)
  }
}

const download_file_from_local_folder = async (res, file_id) => {
  const directory_path = path.join(uploads_path, file_id)
  const files = await get_dir_files(directory_path, file_id)

  const file_to_download = files[0]
  if (!file_to_download) throw createHttpError(500, `Could not open file`)

  // NOTE: Not using sendfile because specifying file name
  res.download(path.join(directory_path, file_to_download), file_to_download)
}

const download_file_from_s3 = async (res, file_id) => {
  const listObjectsresult = await s3.send(
    new ListObjectsCommand({
      Bucket: S3_BUCKET,
      Prefix: file_id,
    })
  )

  if (!listObjectsresult.Contents || !listObjectsresult.Contents.length)
    throw `File ${file_id} does not exist`

  const { Key } = listObjectsresult.Contents[0]
  const getObjectResult = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key,
    })
  )

  const filename = Key.split("/").at(-1)

  getObjectResult.Body.transformToWebStream().pipeTo(
    new WritableStream({
      start() {
        // TODO: add size
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${encodeURIComponent(filename)}`
        )
      },
      write(chunk) {
        res.write(chunk)
      },
      close() {
        res.end()
      },
    })
  )
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
    if (S3_BUCKET) await download_file_from_s3(res, file_id)
    else await download_file_from_local_folder(res, file_id)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.get_file_name = async (req, res, next) => {
  // TODO: figure out if this can be removed
  // Used by GET /applications/:application_id/files/:file_id/filename'
  // Used by PDF only GUI in PDF viewer

  const { file_id } = req.params

  if (!file_id) throw createError(400, `File ID not specified`)

  const directory_path = path.join(uploads_path, file_id)
  const files = await get_dir_files(directory_path, file_id)
  const filename = files[0]
  res.send({ filename })
}
