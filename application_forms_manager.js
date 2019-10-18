const express = require('express')
const bodyParser = require('body-parser')
const neo4j = require('neo4j-driver').v1
const cors = require('cors')
const cookieSession = require('cookie-session')
const uuidv1 = require('uuid/v1');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');


var driver = neo4j.driver(
  'bolt://localhost',
  neo4j.auth.basic('neo4j', 'poketenashi')
)

const toLocaleDateStringOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };


function check_authentication(req, res, next) {
  if(!req.session.employee_number) res.status(400).send("Unauthorized");
  else next();
}

const port = 9723
const app = express()

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: [
    'http://172.16.98.151:8083',
    'http://172.16.98.151',
    'http://mike.jtekt',
    'http://mike.jtekt:8083',
  ],
  credentials: true,
}));
app.use(cookieSession({
  name: 'session',
  secret: 'gomadango',
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
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(function(error) {
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
    WITH DISTINCT recipient, a // Avoid duplicate recipients

    // WATNING: recipients passed as list of node properties
    MATCH (r:Employee {employee_number: recipient.employee_number} )
    CREATE (r)<-[:SUBMITTED_TO {date: date({submission_date})}]-(a)
    RETURN a
    `, {
    submitter_employee_number: req.session.employee_number,
    type: req.body.type,
    form_data: JSON.stringify(req.body.form_data), // Neo4J does not support nested props
    recipients: req.body.recipients,
    submission_date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
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
    MERGE (a)<-[:APPROVED {date: date({approval_date})}]-(approver)

    RETURN a`, {
    approver_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
    approval_date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
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
