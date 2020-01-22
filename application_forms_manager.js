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

const uploads_directory_path = path.join(__dirname, 'uploads')

const port = 9723

var driver = neo4j.driver(
  'bolt://localhost',
  neo4j.auth.basic(credentials.neo4j.username, credentials.neo4j.password)
)

process.env.TZ = 'Asia/Tokyo';

const toLocaleDateStringOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

// EXTERNALIZE THIS
function check_authentication(req, res, next) {
  if(!req.session.employee_number) res.status(400).send("Unauthorized");
  else next();
}

const app = express()

app.use(bodyParser.json());
app.use(history({
  // Ignore route /file
  rewrites: [
    { from: '/file', to: '/file'}
  ]
}));
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



app.post('/create_application',check_authentication, (req, res) => {
  // Route to create or edit an application

  var session = driver.session();
  session
  .run(`
    // Create the application node
    MATCH (s:Employee {employee_number: {submitter_employee_number}} )
    CREATE (a:ApplicationForm)-[:SUBMITTED_BY {date: date()} ]->(s)
    SET a.title = {title}
    SET a.form_data = {form_data}
    SET a.creation_date = date()

    SET a.type = {type} // WILL NOT BE NEEDED ONCE ABLE TO USE TEMPLATES

    // EXPERIMENT
    SET a.current_flow_index = toInt(0)

    // Relationship to template used
    WITH a
    MATCH (aft:ApplicationFormTemplate)
    WHERE id(aft)=toInt({template_id})
    CREATE (a)-[:BASED_ON]->(aft)

    // Relationship with recipients
    // This also creates flow indices
    WITH a, {recipients_employee_number} as recipients_employee_number
    UNWIND range(0, size(recipients_employee_number)-1) as i
    MATCH (r:Employee {employee_number: recipients_employee_number[i]} )
    CREATE (r)<-[:SUBMITTED_TO {date: date(), flow_index: i} ]-(a)

    // Return the application
    RETURN a
    `, {
    submitter_employee_number: req.session.employee_number,
    type: req.body.type,
    title: req.body.title,
    form_data: JSON.stringify(req.body.form_data), // Neo4J does not support nested props so convert to string
    recipients_employee_number: req.body.recipients_employee_number,
    template_id: req.body.template_id,
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

app.post('/delete_application',check_authentication, (req, res) => {

  // Only the creator can delete the application
  var session = driver.session()
  session
  .run(`
    // Find the application to be deleted using provided id
    MATCH (:Employee{employee_number: {employee_number}})<-[:SUBMITTED_BY]-(a:ApplicationForm)
    WHERE id(a) = toInt({application_id})

    // Delete it
    DETACH DELETE a
    `, {
    employee_number: req.session.employee_number,
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



app.post('/get_submitted_applications/pending',check_authentication, (req, res) => {

  var session = driver.session()

  session
  .run(`
    // Get all submissions of given application
    MATCH (applicant:Employee {employee_number:{applicant_employee_number}})<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(e:Employee)

    // EXCLUDE REJECTS
    WHERE NOT ()-[:REJECTED]->(application)

    // Get all approvals of the application
    WITH application, applicant, count(submission) as cs
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(:Employee)

    WITH application, applicant, cs, count(approval) as ca
    WHERE NOT cs = ca

    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
    applicant_employee_number: req.session.employee_number
  })
  .then(result => {
    // THIS SHOULD BE RECORDS!
    res.send(result.records)
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
    MATCH (applicant:Employee {employee_number:{applicant_employee_number}})<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(:Employee)

    // Get all approvals of the application
    WITH application, applicant, count(submission) as cs
    MATCH (application)<-[approval:APPROVED]-(:Employee)

    // If the number of approval matches that of submissions, then completely approved
    WITH application, applicant, cs, count(approval) as ca
    WHERE cs = ca
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
    applicant_employee_number: req.session.employee_number
  })
  .then(result => {
    // THIS SHOULD BE RECORDS!
    res.send(result.records)
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
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
    applicant_employee_number: req.session.employee_number
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


app.post('/get_received_applications/pending', (req, res) => {
  // Returns applications submitted to a user but not yet approved
  var session = driver.session()

  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(e:Employee {employee_number: {recipient_employee_number} } )
    WHERE NOT (application)<-[:APPROVED]-(e) AND NOT (application)<-[:REJECTED]-(e)
    AND submission.flow_index = application.current_flow_index

    // Return
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
      recipient_employee_number: req.session.employee_number
  })
  .then((result) => {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500)
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
    RETURN application, applicant
    ORDER BY application.creation_date DESC`, {
      recipient_employee_number: req.session.employee_number
  })
  .then( (result) => {
    res.send(result.records)
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
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
      recipient_employee_number: req.session.employee_number
  })
  .then(function(result) {
    res.send(result.records)
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

    // get the application template if exists
    WITH application, applicant, submitted_by, recipient, submitted_to, approval, rejection
    OPTIONAL MATCH (application)-[:BASED_ON]->(aft:ApplicationFormTemplate)


    // Return everything
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval, rejection, aft

    // Ordering flow
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

app.post('/find_application_by_hanko',check_authentication, (req, res) => {
  // Get a single application
  var session = driver.session()

  session
  .run(`
    // Find application and applicant
    MATCH (application:ApplicationForm)<-[approval:APPROVED]-()
    WHERE id(approval) = toInt({approval_id})

    // Return everything
    RETURN application
    `, {
    approval_id: req.body.approval_id,
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

  // TODO: Add check for application flow index

  var session = driver.session()
  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee {employee_number: {recipient_employee_number} })
    WHERE id(application) = toInt({application_id})

    // Increase flow index to allow next recipient to approve
    SET application.current_flow_index = toInt(submission.flow_index + 1)

    // Mark as approved
    WITH application, recipient
    MERGE (application)<-[:APPROVED {date: date()}]-(recipient)

    // RETURN APPLICATION
    RETURN application`, {
    recipient_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
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
  // basically the opposite of putting a hanko

  var session = driver.session()

  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee {employee_number: {approver_employee_number} })
    WHERE id(application) = toInt({application_id})

    // No need to increase flow index

    // Mark as REJECTED
    WITH application, recipient
    MERGE (application)<-[rejection:REJECTED {date: date()}]-(recipient)
    SET rejection.reason = {reason}

    // RETURN APPLICATION
    RETURN application`, {
    approver_employee_number: req.session.employee_number,
    application_id: req.body.application_id,
    reason: req.body.reason,
  })
  .then(function(result) {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500).send("error")
  })
})

app.post('/cancel_decision',check_authentication, (req, res) => {

  // This route is no longer used because it is now imposible to cancel a hanko

  var session = driver.session()

  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee {employee_number: {approver_employee_number} })
    WHERE id(application) = toInt({application_id})

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
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500)
  })
})

app.post('/create_application_form_template', check_authentication, (req, res) => {

  // Create application form template
  var session = driver.session()

  session
  .run(`
    // Find creator
    MATCH (creator:Employee {employee_number: {creator_employee_number} })
    CREATE (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator)

    // setting all properties
    SET aft.fields={fields}
    SET aft.label={label}

    // visibility (shared with)
    WITH aft
    MATCH (g)
    WHERE id(g)=toInt({target_id})
    CREATE (aft)-[:VISIBLE_TO]->(g)

    // RETURN
    RETURN aft`, {
    creator_employee_number: req.session.employee_number,
    fields: JSON.stringify(req.body.fields),
    label: req.body.label,
    target_id: req.body.target_id,
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



app.post('/edit_application_form_template', check_authentication, (req, res) => {

  // Create template
  var session = driver.session()
  session
  .run(`
    // Find template
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee {employee_number: {creator_employee_number} })
    WHERE id(aft) = toInt({id})

    // set properties
    SET aft.fields={fields}
    SET aft.label={label}

    // update visibility (shared with)
    WITH aft
    MATCH (aft)-[vis:VISIBLE_TO]->(g)
    DETACH DELETE vis
    WITH aft
    MATCH (g)
    WHERE id(g)=toInt({target_id})
    CREATE (aft)-[:VISIBLE_TO]->(g)



    // RETURN
    RETURN aft`, {
    creator_employee_number: req.session.employee_number,
    id: req.body.id,
    fields: JSON.stringify(req.body.fields),
    label: req.body.label,
    target_id: req.body.target_id
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

app.post('/delete_application_form_template', check_authentication, (req, res) => {

  // Delete application form template

  var session = driver.session()
  session
  .run(`
    // Find application
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee {employee_number: {creator_employee_number} })
    WHERE id(aft) = toInt({id})

    // Delete the node
    DETACH DELETE aft

    // RETURN
    RETURN creator`, {
    creator_employee_number: req.session.employee_number,
    id: req.body.id,
  })
  .then((result) => {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500)
  })
})


app.post('/get_all_application_form_templates', check_authentication, (req, res) => {

  // Create application form template
  var session = driver.session()
  session
  .run(`
    MATCH (creator:Employee)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)-[:VISIBLE_TO]->(g)<-[:BELONGS_TO]-(:Employee {employee_number: {employee_number} })
    RETURN aft, creator, g`, {
      employee_number: req.session.employee_number
    })
  .then((result) => {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500)
  })
})

app.post('/get_application_form_templates_from_user', check_authentication, (req, res) => {


  // Create application form template

  var session = driver.session()
  session
  .run(`
    // Find creator
    MATCH (g)<-[:VISIBLE_TO]-(aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee {employee_number: {creator_employee_number} })

    // RETURN
    RETURN aft, g`, {
    creator_employee_number: req.session.employee_number,
  })
  .then((result) => {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500)
  })
})

app.post('/get_application_form_template', check_authentication, (req, res) => {

  // get a single  application form template
  var session = driver.session()
  session
  .run(`
    MATCH (g)<-[:VISIBLE_TO]-(aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee)
    WHERE id(aft) = toInt({id})
    RETURN aft, g, creator`, {
    id: req.body.id,
  })
  .then((result) => {
    res.send(result.records)
    session.close()
  })
  .catch(error => {
    console.log(error)
    res.status(500)
  })
})


app.post('/file_upload',check_authentication, (req, res) => {
  // Route to upload an attachment
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    if (err) throw err;

    var old_path = files.file_to_upload.path;
    var file_name = files.file_to_upload.name;

    var new_directory_name = uuidv1();
    var new_directory_path = path.join(uploads_directory_path, new_directory_name);

    // Create the new directory
    fs.mkdir(new_directory_path, { recursive: true }, (err) => {
      if (err) throw err;

      var new_file_path = path.join(new_directory_path,file_name);

      fs.rename(old_path, new_file_path, function (err) {
        if (err) throw err;
        console.log(`Uploaded file ${new_file_path}`)
        res.send(new_directory_name)
      });

    });
  });
});

app.get('/file', check_authentication, (req, res) => {
  // Todo: serve file

  if('id' in req.query){

    var directory_path = path.join(uploads_directory_path, req.query.id)
    console.log(directory_path)

    fs.readdir(directory_path, (err, items) => {
      if(err) console.log(err)
      // Send first file in the directory
      res.sendFile(path.join(directory_path, items[0]))
    });


  }
  else {
    res.status(400).send('ID not specified')
  }
});


// Start the server
app.listen(port, () => console.log(`Application form manager listening on port ${port}!`))
