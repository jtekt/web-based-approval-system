const mv = require('mv')
const fs = require('fs')
const path = require('path')
const uuidv1 = require('uuid/v1')
const formidable = require('formidable')
const driver = require('../neo4j_driver.js')

const uploads_directory_path = "/usr/share/pv" // For production in k8s


exports.file_upload = (req, res) => {
  // Route to upload an attachment
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    if (err) return res.status(500).send('Error parsing the data')

    var old_path = files.file_to_upload.path;
    var file_name = files.file_to_upload.name;

    var new_directory_name = uuidv1();
    var new_directory_path = path.join(uploads_directory_path, new_directory_name);

    // Create the new directory
    var new_file_path = path.join(new_directory_path,file_name);

    mv(old_path, new_file_path, {mkdirp: true}, (err) => {
      if (err) return res.status(500).send('Error saving the file')
      res.send(new_directory_name)
      console.log(`${file_name} uploaded`)
    });

  })
}

exports.get_file = (req, res) => {

  let file_id = req.params.file_id
    || req.query.file_id

  if(!file_id) return res.status(400).send('File ID not specified')

  // Application ID not strictly neccessary but helps find the file more easily
  let application_id = req.params.application_id
    || req.query.application_id

  if(!application_id) return res.status(400).send('Application ID not specified')

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInt({application_id})

    // The requested file must be a file of the application
    WITH user, application
    // THIS IS REALLY DIRTY BUT IT'S THE BEST I CAN DO SO FAR
    WHERE application.form_data CONTAINS {file_id}

    // Enforce privacy
    WITH user, application
    WHERE NOT application.private
      OR NOT EXISTS(application.private)
      OR (application)-[:SUBMITTED_BY]->(user)
      OR (application)-[:SUBMITTED_TO]->(user)
      OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)

    return application
    `, {
      user_id: res.locals.user.identity.low,
      file_id: file_id,
      application_id: application_id,
  })
  .then((result) => {
    if(result.records.length === 0) return res.send(400).send('The file cannot be downloaded. Either it does not exist or is private')


    let directory_path = path.join(uploads_directory_path, file_id)

    fs.readdir(directory_path, (err, items) => {
      if(err) return res.status(500).send("Error reading uploads directory")
      // Send first file in the directory
      res.download( path.join(directory_path, items[0]),items[0] )
    });

  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}
