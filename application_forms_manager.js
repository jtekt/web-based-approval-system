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
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/create_application',check_authentication, (req, res) => {
  // Route to create or edit an application



  var session = driver.session();
  session
  .run(`
    // Create the application node
    MATCH (s:Employee {employee_number: {submitter_employee_number}} )
    CREATE (a:ApplicationForm)-[:SUBMITTED_BY {date: date({submission_date})} ]->(s)
    SET a.type = {type}
    SET a.title = {title}
    SET a.form_data = {form_data}
    SET a.creation_date = date({submission_date})

    // Relationship with recipients with flow index
    WITH a, {recipients_employee_number} as recipients_employee_number
    UNWIND range(0, size(recipients_employee_number)-1) as i
    MATCH (r:Employee {employee_number: recipients_employee_number[i]} )
    CREATE (r)<-[:SUBMITTED_TO {date: date({submission_date}), flow_index: i} ]-(a)

    // Referral to application if settlement
    WITH a
    MATCH (ra:ApplicationForm)
    WHERE ID(ra) = {referred_application_id}
    CREATE (ra)-[:REFERS_TO]->(a)

    // Return
    RETURN a
    `, {
    submitter_employee_number: req.session.employee_number,
    type: req.body.type,
    title: req.body.title,
    form_data: JSON.stringify(req.body.form_data), // Neo4J does not support nested props so convert to string
    recipients_employee_number: req.body.recipients_employee_number,
    submission_date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),

    // If this is a settlement, need to refer to corresponding application
    referred_application_id: (req.body.referred_application_id ? req.body.referred_application_id : 'no_id'),
  })
  .then((result) => {
    console.log(result.records)
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })

})

app.post('/delete_application',check_authentication, (req, res) => {

  // Only the creator can delete the application


  var session = driver.session()
  session
  .run(`
    // Find the application to be deleted using provided id
    MATCH (applicant:Employee{employee_number: {employee_number}})<-[:SUBMITTED_BY]-(a:ApplicationForm)
    WHERE id(a) = {application_id}

    // Delete it
    DETACH DELETE a
    `, {
    employee_number: req.session.employee_number,
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

  // NOT USED ANYMORE

  var session = driver.session()

  session
  .run(`
    // Get applications submitted by logged user
    MATCH (application:ApplicationForm)-[submitted_by:SUBMITTED_BY]->(applicant:Employee {employee_number: {applicant_employee_number} } )

    //Return
    RETURN application
    `, {
    applicant_employee_number: req.session.employee_number
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

app.post('/get_submitted_applications/pending',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Get all submissions of given application
    MATCH (:Employee {employee_number:{applicant_employee_number}})<-[:SUBMITTED_BY]-(a:ApplicationForm)-[submission:SUBMITTED_TO]->(e:Employee)

    // EXCLUDE REJECTS
    WHERE NOT ()-[:REJECTED]->(a)

    // Get all approvals of the application
    WITH a, count(submission) as cs
    OPTIONAL MATCH (a)<-[approval:APPROVED]-(:Employee)

    WITH a, cs, count(approval) as ca
    WHERE NOT cs = ca

    RETURN a
    `, {
    applicant_employee_number: req.session.employee_number
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

app.post('/get_submitted_applications/approved',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Get all submissions of given application
    MATCH (:Employee {employee_number:{applicant_employee_number}})<-[:SUBMITTED_BY]-(a:ApplicationForm)-[submission:SUBMITTED_TO]->(:Employee)

    // Get all approvals of the application
    WITH a, count(submission) as cs
    MATCH (a)<-[approval:APPROVED]-(:Employee)

    // If the number of approval matches that of submissions, then completely approved
    WITH a, cs, count(approval) as ca
    WHERE cs = ca
    RETURN a
    `, {
    applicant_employee_number: req.session.employee_number
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

app.post('/get_submitted_applications/rejected',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Get applications submitted by logged user
    MATCH (applicant:Employee {employee_number: {applicant_employee_number} } )<-[submitted_by:SUBMITTED_BY]-(application:ApplicationForm)<-[:REJECTED]-(:Employee)

    //Return
    RETURN application
    `, {
    applicant_employee_number: req.session.employee_number
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


app.post('/get_received_applications', (req, res) => {

  // NOT USED ANYMORE

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
  .catch(error => {
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
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[:SUBMITTED_TO]->(e:Employee {employee_number: {recipient_employee_number} } )
    WHERE NOT (application)<-[:APPROVED]-(e) AND NOT (application)<-[:REJECTED]-(e)


    // Return
    RETURN application, applicant`, {
      recipient_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(error => {
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
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)<-[:APPROVED]-(:Employee {employee_number: {recipient_employee_number} } )

    // Return
    RETURN application, applicant`, {
      recipient_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/get_received_applications/rejected', (req, res) => {
  // Returns applications rejected by a user
  var session = driver.session()

  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)<-[:REJECTED]-(:Employee {employee_number: {recipient_employee_number} } )

    // Return
    RETURN application, applicant`, {
      recipient_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/get_application',check_authentication, (req, res) => {
  // Get a single application
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

    // Find approvals
    WITH application, applicant, submitted_by, recipient, submitted_to
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

    // Find rejections

    // MAYBE COULD GET BOTH AT THE SAME TIME WITH WHERE LABEL(r) = "APPROVED" OR LABEL(r)

    WITH application, applicant, submitted_by, recipient, submitted_to, approval
    OPTIONAL MATCH (application)<-[rejection:REJECTED]-(recipient)

    // Find applications this one refers to
    // TODO

    // Find applications referred to this one
    // TODO

    // Return everything
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval, rejection

    ORDER BY submitted_to.flow_index DESC
    `, {
    application_id: req.body.application_id,
  })
  .then(result => {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })

})

app.post('/approve_application',check_authentication, (req, res) => {

  var session = driver.session()
  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee {employee_number: {recipient_employee_number} })
    WHERE id(application) = {application_id}

    // Mark as approved
    WITH application, recipient
    MERGE (application)<-[:APPROVED {date: date({date})}]-(recipient)

    // RETURN APPLICATION
    RETURN application`, {
    recipient_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
    date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
  })
  .then(result => {
    session.close()
    res.send(result.records)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/reject_application',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee {employee_number: {approver_employee_number} })
    WHERE id(application) = {application_id}

    // Mark as approved
    WITH application, recipient
    MERGE (application)<-[:REJECTED {date: date({date})}]-(recipient)

    // RETURN APPLICATION
    RETURN application`, {
    approver_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
    date: new Date().toLocaleDateString("ja-JP", toLocaleDateStringOptions),
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/cancel_decision',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee {employee_number: {approver_employee_number} })
    WHERE id(application) = {application_id}

    // Delete relationsip, approval or rejection
    WITH application, recipient
    MATCH (application)<-[r]-(recipient)
    WHERE type(r) = "REJECTED" OR  type(r) = "APPROVED"
    DELETE r

    // RETURN APPLICATION
    RETURN application`, {
    approver_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
  })
  .then(function(result) {
    res.send(result)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})


app.post('/file_upload',check_authentication, function (req, res) {
  ////////////////////////
  // TODO; NEEDS IMPROVEMENTS!!
  ///////////////////////
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
