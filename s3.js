const path = require("path")
const { addProxyToClient } = require("aws-sdk-v3-proxy")
const { v4: uuidv4 } = require("uuid")
const fs = require("fs")
const {
  S3Client,
  PutObjectCommand,
  ListObjectsCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3")

const {
  S3_REGION,
  S3_ACCESS_KEY_ID = "",
  S3_SECRET_ACCESS_KEY = "",
  S3_ENDPOINT,
  S3_BUCKET,
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

let s3Client

if (S3_BUCKET) {
  console.log(
    `[S3] S3_BUCKET is set, uploading attachment to S3 bucket "${S3_BUCKET}"`
  )
  s3Client = HTTPS_PROXY
    ? addProxyToClient(new S3Client(s3ClientOptions))
    : new S3Client(s3ClientOptions)
} else {
  console.log(`[S3] S3_BUCKET not set, storing attachments locally`)
}

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

const download_file_from_s3 = async (res, file_id) => {
  const listObjectsresult = await s3Client.send(
    new ListObjectsCommand({
      Bucket: S3_BUCKET,
      Prefix: file_id,
    })
  )

  if (!listObjectsresult.Contents || !listObjectsresult.Contents.length)
    throw `File ${file_id} does not exist`

  const { Key } = listObjectsresult.Contents[0]
  const getObjectResult = await s3Client.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key,
    })
  )

  const { base: filename } = path.parse(Key)

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

exports.S3_BUCKET = S3_BUCKET
exports.S3_REGION = S3_REGION
exports.download_file_from_s3 = download_file_from_s3
exports.store_file_on_s3 = store_file_on_s3
exports.s3Client = s3Client
