const mv = require('mv')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const formidable = require('formidable')
const {driver} = require('../../db.js')

// TODO: make this configurable
const uploads_directory_path = "/usr/share/pv" // For production as docker container


exports.file_upload = (req, res) => {
  // Route to upload an attachment
  // TODO: use promises
  // NOTE: Could use multer
  const form = new formidable.IncomingForm()
  form.parse(req, function (err, fields, files) {
    if (err) return res.status(500).send('Error parsing the data')

    const {
      path: old_path,
      name: file_name
    } = files.file_to_upload

    var new_directory_name = uuidv4()
    var new_directory_path = path.join(uploads_directory_path, new_directory_name)

    // Create the new directory
    var new_file_path = path.join(new_directory_path,file_name);

    mv(old_path, new_file_path, {mkdirp: true}, (err) => {
      if (err) return res.status(500).send('Error saving the file')
      res.send(new_directory_name)
      console.log(`${file_name} uploaded`)
    })

  })
}

exports.get_file = (req, res) => {

  // TODO: probably now only using params so get rid of query
  // TODO: Check if can be set as const
  // TODO: refactor
  let file_id = req.params.file_id
    || req.query.file_id

  if(!file_id) return res.status(400).send('File ID not specified')

  let application_id = req.params.application_id
    || req.query.application_id

  if(!application_id) return res.status(400).send('Application ID not specified')

  const user_id = res.locals.user.identity.low ?? res.locals.user.identity

  const query = `
    // Find current user to check for authorization
    MATCH (user:User)
    WHERE id(user)=toInteger($user_id)

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInteger($application_id)

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
    if(!records.length) {
      return res.send(400).send('The file cannot be downloaded. Either it does not exist or is private')
    }

    // Check if the application has a file with the given ID
    const application_node = records[0].get('application')
    const form_data = JSON.parse(application_node.properties.form_data)
    const found_file = form_data.find( (field) => field.value === file_id)
    if(!found_file) return res.send(400).send('This application does not contain a file with the provided file ID')

    // Now download the file
    const directory_path = path.join(uploads_directory_path, file_id)
    fs.readdir(directory_path, (err, items) => {
      if(err) {
        console.log("Error reading uploads directory")
        return res.status(500).send("Error reading uploads directory")
      }
      // Send first file in the directory (one file per directory)
      const file_to_download = items[0]
      // NOTE: Why not sendFile?
      res.download( path.join(directory_path, file_to_download), file_to_download )
      console.log(`File ${file_to_download} has been downloaded`)
    })

  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })

}
