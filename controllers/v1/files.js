const mv = require('mv')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const formidable = require('formidable')
const {driver} = require('../../db.js')
const {
  visibility_enforcement,
  get_current_user_id,
  get_application_id,
  error_handling,
  filter_by_user_id,
  filter_by_applcation_id,
} = require('../../utils.js')

// TODO: make this configurable
const uploads_directory_path = "/usr/share/pv" // For production as docker container


exports.file_upload = (req, res) => {
  // Route to upload an attachment
  // TODO: use promises
  // NOTE: Could use multer
  const form = new formidable.IncomingForm()
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).send('Error parsing the data')

    if(!files.file_to_upload) return res.status(400).send('Missing file')

    const {
      path: old_path,
      name: file_name
    } = files.file_to_upload

    const new_directory_name = uuidv4()
    const new_directory_path = path.join(uploads_directory_path, new_directory_name)

    // Create the new directory
    const new_file_path = path.join(new_directory_path,file_name);

    mv(old_path, new_file_path, {mkdirp: true}, (err) => {
      if (err) return res.status(500).send('Error saving the file')
      res.send(new_directory_name)
      console.log(`${file_name} uploaded`)
    })

  })
}

exports.get_file = (req, res) => {

  const {file_id} = req.params
  const user_id = get_current_user_id(res)
  const application_id = get_application_id(req)

  if(!file_id) return res.status(400).send('File ID not specified')
  if(!application_id) return res.status(400).send('Application ID not specified')


  const query = `
    // Find current user to check for authorization
    MATCH (user:User)
    ${filter_by_user_id}

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    ${filter_by_applcation_id}

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

  const session = driver.session()
  session.run(query, params)
  .then(({records}) => {

    // Check if the application exists (i.e. can be seen by the user)
    if(!records.length) throw {code: 400, message: `Application ${application_id} could not be queried`}

    // Check if the application has a file with the given ID
    const application_node = records[0].get('application')
    const form_data = JSON.parse(application_node.properties.form_data)
    const found_file = form_data.find( ({value}) => value === file_id)
    if(!found_file) throw {code: 400, message: `Application ${application_id} does not includes file ${file_id}`}

    // Now download the file
    const directory_path = path.join(uploads_directory_path, file_id)
    fs.readdir(directory_path, (err, items) => {
      if(err) throw {code: 400, message: `Error reading uploads directory`}
      // Send first file in the directory (one file per directory)
      const file_to_download = items[0]
      console.log(`File ${file_id} of application ${application_id} downloaded by user ${user_id}`)
      // NOTE: Why not sendFile?
      res.download( path.join(directory_path, file_to_download), file_to_download )
    })

  })
  .catch(error => { error_handling(error, res) })
  .finally(() => { session.close() })

}

exports.get_file_name = (req, res) => {

  const {file_id} = req.params

  if(!file_id) return res.status(400).send('File ID not specified')


  // Now download the file
  const directory_path = path.join(uploads_directory_path, file_id)
  fs.readdir(directory_path, (err, items) => {

    if(err) return res.status(400).send(`File could not be opened`)
    // Send first file in the directory (one file per directory)
    const filename = items[0]
    // NOTE: Why not sendFile?
    res.send({filename})
  })



}



function get_unused_files(){

  return new Promise((resolve, reject) => {
    const session = driver.session()

    session.run(`
      MATCH (application:ApplicationForm)
      WHERE application.form_data CONTAINS 'file'
      RETURN application.form_data as form_data
      `, {})
    .then(({records}) => {

      const attachments = records.reduce((acc, record) => {
        const fields = JSON.parse(record.get('form_data'))

        // File fileds of this record (can be empty)
        const file_fields = fields.filter(field => field.type === 'file' && !!field.value)
        if(file_fields.length > 0) {
          file_fields.forEach(field => {acc.push(field.value)} )
        }

        return acc

      }, [])

      const directories = readdirSync(uploads_directory_path)

      // ignore trash
      const unused_uploads = directories.filter( directory => {
        return !attachments.find(attachment => (directory === attachment || directory === 'trash') )
      })

      resolve(unused_uploads)
    })
    .catch(reject)
    .finally(() => { session.close() })

  })

}

exports.get_unused_files = (req, res) => {
  get_unused_files()
  .then(unused_uploads => {
    res.send(unused_uploads)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
}

exports.move_unused_files = (req, res) => {

  const user = res.locals.user
  if(!user.properties.isAdmin) return res.status(403).send('User must be admin')

  get_unused_files()
  .then(unused_uploads => {

    const promises = []
    unused_uploads.forEach(upload => {

      const promise = new Promise((resolve, reject) => {
        const old_path = path.join(uploads_directory_path,upload)
        const new_path = path.join(uploads_directory_path,'trash',upload)

        mv(old_path, new_path, {mkdirp: true}, (err) => {
          if (err) return reject(err)
          resolve(upload)
        })
      })

      promises.push(promise)

    })

    return Promise.all(promises)

  })
  .then( (items) => {
    res.send({deleted_count: items.length})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })

}
