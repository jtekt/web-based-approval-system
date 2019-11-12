const express = require('express')
const bodyParser = require('body-parser')
const neo4j = require('neo4j-driver').v1
const cors = require('cors')
const cookieSession = require('cookie-session')
const uuidv1 = require('uuid/v1');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const history = require('connect-history-api-fallback'); // To allow refresh of Vue

// Custom modules
const credentials = require('../common/credentials');
const utils = require('../common/utils');
const misc = require('../common/misc');

const port = 9723

var driver = neo4j.driver(
  'bolt://localhost',
  neo4j.auth.basic(credentials.neo4j.username, credentials.neo4j.password)
)

const toLocaleDateStringOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

// EXTERNALIZE THIS
function check_authentication(req, res, next) {
  if(!req.session.employee_number) res.status(400).send("Unauthorized");
  else next();
}

const app = express()

app.use(bodyParser.json());
app.use(history());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: misc.cors_origins,
  credentials: true,
}));
app.use(cookieSession({
  name: 'session',
  secret: credentials.session.secret,
  maxAge: 253402300000000
}));

app.post('/get_employees', (req, res) => {
  // THIS ROUTE IS FOR TESTING PURPOSES

  var session = driver.session()

  session
  .run(`
    MATCH (e:Employee)
    RETURN e`, {}
  )
  .then((result) => {
    res.send(result)
    session.close()
  })
  .catch((error) => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/create_application',check_authentication, (req, res) => {
  // Route to create or edit an application

  var session = driver.session()

  session
  .run(`
    // Create the application node
    MATCH (s:Employee {employee_number: {submitter_employee_number}} )
    CREATE (a:ApplicationForm)-[:SUBMITTED_BY {date: date({submission_date})}]->(s)
    SET a.type = {type}
    SET a.form_data = {form_data}
    SET a.creation_date = {submission_date}

    // Relationship with recipients
    WITH a
    UNWIND {recipients} as recipient

    // WATNING: recipients passed as list of node properties and not list of employee numbers
    MATCH (r:Employee {employee_number: recipient.employee_number} )
    CREATE (r)<-[:SUBMITTED_TO {date: date({submission_date}), flow_index: recipient.flow_index}]-(a)
    RETURN a
    `, {
    submitter_employee_number: req.session.employee_number,
    type: req.body.type,
    form_data: JSON.stringify(req.body.form_data), // Neo4J does not support nested props
    recipients: req.body.recipients,
    submission_date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
  })
  .then((result) => {
    res.send(result)
    session.close()
  })
  .catch((error) => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/delete_application',check_authentication, (req, res) => {
  // TODO: Check if user is in position to delete the application
  // TODO: CHECK if application_id in the body

  var session = driver.session()

  session
  .run(`
    // Find the application to be approved using provided id
    MATCH (approver)<-[submission:SUBMITTED_TO]-(a:ApplicationForm)
    WHERE id(a) = {application_id}
    DETACH DELETE a
    `, {
    application_id: req.body.application_id,
  })
  .then(result => {
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })

})

app.post('/get_submitted_applications',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Get applications submitted by logged user
    MATCH (application:ApplicationForm)-[submitted_by:SUBMITTED_BY]->(applicant:Employee {employee_number: {applicant_employee_number} } )

    // Get recipients
    WITH application, applicant, submitted_by
    OPTIONAL MATCH (application)-[submitted_to:SUBMITTED_TO]->(recipient:Employee)

    // Get Approvers
    WITH application, applicant, submitted_by, recipient, submitted_to
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

    //Return
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval
    `, {
    applicant_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(function(error) {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/get_received_applications', (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Get applications submitted to logged user
    MATCH (application:ApplicationForm)-[:SUBMITTED_TO]->(:Employee {employee_number: {recipient_employee_number} } )

    // Get applicant
    WITH application
    MATCH (application:ApplicationForm)-[submitted_by:SUBMITTED_BY]->(applicant:Employee)

    // Get other recipients
    WITH application, applicant, submitted_by
    MATCH (application:ApplicationForm)-[submitted_to:SUBMITTED_TO]->(recipient:Employee)

    // Optionally get APPROVED relationships
    WITH application, applicant, submitted_by, recipient, submitted_to
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

    // Return
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval`, {
      recipient_employee_number: req.session.employee_number
  })
  .then((result) => {
    res.send(result.records)
    session.close()
  })
  .catch((error) => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/get_received_applications/pending', (req, res) => {
  // Returns applications submitted to a user but not yet approved
  var session = driver.session()

  session
  .run(`
    // Get applications submitted to logged user
    MATCH (application:ApplicationForm)-[:SUBMITTED_TO]->(e:Employee {employee_number: {recipient_employee_number} } )
    WHERE NOT (application)<-[:APPROVED]-(e)

    // Get applicant
    WITH application
    MATCH (application:ApplicationForm)-[submitted_by:SUBMITTED_BY]->(applicant:Employee)

    // Get other recipients
    WITH application, applicant, submitted_by
    MATCH (application:ApplicationForm)-[submitted_to:SUBMITTED_TO]->(recipient:Employee)

    // Return
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval`, {
      recipient_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(function(error) {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/get_received_applications/approved', (req, res) => {
  // Returns applications approved by a user
  var session = driver.session()

  session
  .run(`
    // Get applications submitted to logged user
    MATCH (application:ApplicationForm))<-[approval:APPROVED]-(:Employee {employee_number: {recipient_employee_number} } )

    // Get applicant
    WITH application, approval
    MATCH (application:ApplicationForm)-[submitted_by:SUBMITTED_BY]->(applicant:Employee)

    // Get other recipients
    WITH application, applicant, submitted_by, approval
    MATCH (application:ApplicationForm)-[submitted_to:SUBMITTED_TO]->(recipient:Employee)

    // Return
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval`, {
      recipient_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(function(error) {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/get_application',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Find application and applicant
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInt({application_id})

    // Find applicant
    WITH application
    OPTIONAL MATCH (application)-[submitted_by:SUBMITTED_BY]->(applicant:Employee)

    // Find recipients
    WITH application, applicant, submitted_by
    OPTIONAL MATCH (application)-[submitted_to:SUBMITTED_TO]->(recipient:Employee)

    // Find approvers
    WITH application, applicant, submitted_by, recipient, submitted_to
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

    // Return everything
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval
    `, {
    application_id: req.body.application_id,
  })
  .then(result => {
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })

})

app.post('/approve_application',check_authentication, (req, res) => {
  // TODO: Check if user is in position to approve the application
  // TODO: CHECK if application_id in the body

  var session = driver.session()

  session
  .run(`
    // Find oneself as approver
    MATCH (approver:Employee {employee_number: {approver_employee_number} })
    WITH approver

    // Find the application to be approved using provided id
    MATCH (approver)<-[submission:SUBMITTED_TO]-(a:ApplicationForm)
    WHERE id(a) = {application_id}

    // Mark as approved
    WITH a, approver, submission
    MERGE (a)<-[:APPROVED {date: date({date})}]-(approver)

    RETURN a`, {
    approver_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
    date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(function(error) {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/disapprove_application',check_authentication, (req, res) => {
  // TODO: Check if user is in position to disapprove the application
  // TODO: CHECK if application_id in the body


  var session = driver.session()

  session
  .run(`
    // Find oneself as approver
    MATCH (approver:Employee {employee_number: {approver_employee_number} })
    WITH approver

    // Find the application to be approved using provided id
    MATCH (approver)<-[submission:SUBMITTED_TO]-(a:ApplicationForm)
    WHERE id(a) = {application_id}

    // Mark as approved
    WITH a, approver, submission
    MERGE (a)<-[:DISAPPROVED {date: date({date})}]-(approver)

    RETURN a`, {
    approver_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
    date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(function(error) {
    console.log(error)
    res.status(500).send("error")
  })

})


app.post('/file_upload',check_authentication, function (req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    if (err) throw err;
    var oldpath = files.file_to_upload.path;

    var new_file_name = uuidv1() + path.extname(files.file_to_upload.name)
    var newpath = __dirname + '/public/uploads/' + new_file_name;

    fs.rename(oldpath, newpath, function (err) {
      if (err) throw err;
      res.send(new_file_name)
    });
  });
});



app.listen(port, () => console.log(`Example app listening on port ${port}!`))
