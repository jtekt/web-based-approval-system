const express = require('express')
const bodyParser = require('body-parser')
const neo4j = require('neo4j-driver').v1
const cors = require('cors')
const uuidv1 = require('uuid/v1');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const mv = require('mv');
const axios = require('axios')
const Cookies = require('cookies')

// Custom modules
const secrets = require('./secrets');

// Make this an environment variable
//const uploads_directory_path = path.join(__dirname, 'uploads') // for PM2 / Nodemon
const uploads_directory_path = "/usr/share/pv" // For production


const port = 9723

var driver = neo4j.driver(
  secrets.neo4j.url,
  neo4j.auth.basic(secrets.neo4j.username, secrets.neo4j.password)
)

process.env.TZ = 'Asia/Tokyo';

const toLocaleDateStringOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };


const app = express()

app.use(bodyParser.json());
app.use(cors());

const visibility_enforcement = `
  WITH user, application
  WHERE NOT application.private
    OR NOT EXISTS(application.private)
    OR (application)-[:SUBMITTED_BY]->(user)
    OR (application)-[:SUBMITTED_TO]->(user)
    OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
`

// NPM this!
function check_authentication(req, res, next){

  let jwt = undefined

  // See if jwt available from authorization header
  if(!jwt){
    if(('authorization' in req.headers)) {
      jwt = req.headers.authorization.split(" ")[1]
    }
  }

  // Try to get JWT from cookies
  if(!jwt) {
    var cookies = new Cookies(req, res)
    jwt = cookies.get('jwt')
  }

  // if no JWT available, reject requst
  if(!jwt) {
    res.status(403).send('JWT not found in either cookies or authorization header')
  }

  // Send JWT to authentication manager for decoding
  axios.post(secrets.authentication_api_url, { jwt: jwt })
  .then(response => {

    // make the response available to the rest of the route
    res.locals.user = response.data

    // Go to the route
    next()
  })
  .catch(error => {
    res.status(400).send(error)
  })
}

app.post('/create_application', check_authentication, (req, res) => {
  // Route to create or edit an application
  // Todo: replace a with application
  var session = driver.session();
  session
  .run(`
    // Create the application node
    MATCH (s:Employee)
    WHERE id(s)=toInt({user_id})
    CREATE (a:ApplicationForm)-[:SUBMITTED_BY {date: date()} ]->(s)

    // Set the application properties using data passed in the requestr body
    SET a.title = {title}
    SET a.private = {private}
    SET a.form_data = {form_data}
    SET a.creation_date = date()
    SET a.type = {type}

    // Relationship with recipients
    // This also creates flow indices
    // Note: flow cannot be empty
    WITH a, {recipients_ids} as recipients_ids
    UNWIND range(0, size(recipients_ids)-1) as i
    MATCH (r:Employee)
    WHERE id(r)=toInt(recipients_ids[i])
    CREATE (r)<-[:SUBMITTED_TO {date: date(), flow_index: i} ]-(a)

    // Groups to which the aplication is visible
    // Note: can be an empty set so the logic to deal with it looks terrible
    WITH a
    UNWIND
      CASE
        WHEN {group_ids} = []
          THEN [null]
        ELSE {group_ids}
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE id(group) = toInt(group_id)
    WITH collect(group) as groups, a
    FOREACH(group IN groups | MERGE (a)-[:VISIBLE_TO]->(group))

    // Finally, Return the application
    RETURN a
    `, {
    user_id: res.locals.user.identity.low,
    // Stuff from the body
    type: req.body.type,
    title: req.body.title,
    private: req.body.private,
    form_data: JSON.stringify(req.body.form_data), // Neo4J does not support nested props so convert to string
    recipients_ids: req.body.recipients_ids,
    group_ids: req.body.group_ids,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
})


function delete_application(req, res){
  // Deleting an application
  // Only the creator can delete the application
  var session = driver.session()
  session
  .run(`
    // Find the application to be deleted using provided id
    MATCH (user:Employee)<-[:SUBMITTED_BY]-(a:ApplicationForm)
    WHERE id(a) = toInt({application_id})
      AND id(user)=toInt({user_id})

    // Delete the application and all of its relationships
    DETACH DELETE a
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
  })
  .then(result => {
    res.send(result.records)
    console.log(`Application ${req.body.application_id} deleted`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

app.post('/delete_application',check_authentication, delete_application)
app.delete('/delete_application',check_authentication, delete_application)

app.post('/update_privacy_of_application', check_authentication, (req, res) => {
  // Route to create or edit an application

  var session = driver.session();
  session
  .run(`
    // Find the application
    MATCH (a:ApplicationForm)-[:SUBMITTED_BY]->(s)
    WHERE id(a)=toInt({application_id})
      AND id(s)=toInt({user_id})

    // Set the privacy property
    SET a.private = {private}

    // Return the application
    RETURN a

    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
    private: req.body.private,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.post('/update_application_visibility', check_authentication, (req, res) => {
  // Deletes all relationships to groups and recreate them
  var session = driver.session();
  session
  .run(`
    // Find the application
    // Only the applicant can make the update
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(user)
    WHERE id(application)=toInt({application_id})
      AND id(user)=toInt({user_id})

    // delete all visibility relationships
    WITH application
    MATCH (application)-[rel:VISIBLE_TO]->(:Group)
    DELETE rel

    // Now recreate all relationships
    WITH application
    UNWIND
      CASE
        WHEN {group_ids} = []
          THEN [null]
        ELSE {group_ids}
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE id(group) = toInt(group_id)
    WITH collect(group) as groups, application
    FOREACH(group IN groups | MERGE (application)-[:VISIBLE_TO]->(group))

    // Return the application
    RETURN application
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
    group_ids: req.body.group_ids,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})

app.post('/make_application_visible_to_group', check_authentication, (req, res) => {
  // Deletes all relationships to groups and recreate them
  var session = driver.session();
  session
  .run(`
    // Find the application
    // Only the applicant can make the update
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(user)
    WHERE id(application)=toInt({application_id})
      AND id(user)=toInt({user_id})

    // Find the group
    WITH application
    MATCH (group:Group)
    WHERE id(group)=toInt({group_id})

    // Create the application
    MERGE (application)-[:VISIBLE_TO]->(group)

    // Return the application
    RETURN application
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
    group_id: req.body.group_id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})

app.post('/remove_application_visibility_to_group', check_authentication, (req, res) => {
  // Deletes all relationships to groups and recreate them
  var session = driver.session();
  session
  .run(`
    // Find the application
    // Only the applicant can make the update
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(user)
    WHERE id(application)=toInt({application_id})
      AND id(user)=toInt({user_id})

    // Find the group
    WITH application
    MATCH (application)-[rel:VISIBLE_TO]->(group)
    WHERE id(group)=toInt({group_id})

    // delete the relationship
    DELETE rel

    // Return the application
    RETURN application
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
    group_id: req.body.group_id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})


app.get('/submitted_applications',check_authentication, (req, res) => {
  // Get all applications submitted by the logged in user
  var session = driver.session()
  session
  .run(`
    MATCH (applicant:Employee)<-[:SUBMITTED_BY]-(application:ApplicationForm)
    WHERE id(applicant)=toInt({user_id})

    RETURN application
    ORDER BY application.creation_date DESC
    `, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})


app.get('/submitted_applications/pending',check_authentication, (req, res) => {

  var session = driver.session()
  session
  .run(`
    // Get all submissions of given application
    MATCH (applicant:Employee)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(e:Employee)
    WHERE id(applicant)=toInt({user_id})

    // EXCLUDE REJECTS
    WITH application, applicant, submission
    WHERE NOT ()-[:REJECTED]->(application)

    // Get all approvals of the application
    WITH application, applicant, count(submission) as cs
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(:Employee)

    WITH application, applicant, cs, count(approval) as ca
    WHERE NOT cs = ca

    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => {res.send(result.records)})
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.get('/submitted_applications/approved',check_authentication, (req, res) => {


  var session = driver.session()
  session
  .run(`
    // Get all submissions of given application
    MATCH (applicant:Employee)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(:Employee)
    WHERE id(applicant)=toInt({user_id})

    // Get all approvals of the application
    WITH application, applicant, count(submission) as cs
    MATCH (application)<-[approval:APPROVED]-(:Employee)

    // If the number of approval matches that of submissions, then completely approved
    WITH application, applicant, cs, count(approval) as ca
    WHERE cs = ca
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => {
    // THIS SHOULD BE RECORDS!
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.get('/submitted_applications/rejected',check_authentication, (req, res) => {

  var session = driver.session()
  session
  .run(`
    // Get applications submitted by logged user
    MATCH (applicant:Employee)<-[submitted_by:SUBMITTED_BY]-(application:ApplicationForm)<-[:REJECTED]-(:Employee)
    WHERE id(applicant)=toInt({user_id})

    //Return
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => {
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})


app.get('/received_applications',check_authentication, (req, res) => {
  // Returns applications rceived by the logged in user

  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee)
    WHERE id(recipient)=toInt({user_id})

    // Return
    RETURN application
    ORDER BY application.creation_date DESC
    `, {
      user_id: res.locals.user.identity.low,
  })
  .then((result) => {   res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.get('/received_applications/pending',check_authentication, (req, res) => {
  // Returns applications submitted to a user but not yet approved


  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant:Employee)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee)
    WHERE id(recipient)=toInt({user_id})
      AND NOT (application)<-[:APPROVED]-(recipient)
      AND NOT (application)<-[:REJECTED]-(recipient)


    // Check if recipient is next in the flow
    WITH application, recipient, submission, applicant
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(:Employee)

    WITH submission, application, applicant, count(approval) as approvalCount
    WHERE submission.flow_index = approvalCount

    // Return
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
      user_id: res.locals.user.identity.low,
  })
  .then((result) => {
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.get('/received_applications/approved',check_authentication, (req, res) => {
  // Returns applications approved by a user

  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)<-[:APPROVED]-(recipient:Employee)
    WHERE id(recipient)=toInt({user_id})

    // Return
    RETURN application, applicant
    ORDER BY application.creation_date DESC`, {
      user_id: res.locals.user.identity.low,
  })
  .then( (result) => {
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.get('/received_applications/rejected',check_authentication, (req, res) => {
  // Returns applications rejected by a user

  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)<-[:REJECTED]-(recipient:Employee)
    WHERE id(recipient)=toInt({user_id})

    // Return
    RETURN application, applicant
    ORDER BY application.creation_date DESC
    `, {
      user_id: res.locals.user.identity.low,
  })
  .then((result) => {
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.get('/application',check_authentication, (req, res) => {
  // Get a single application using its ID

  // TODO: should return a single record

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:Employee)
    WHERE id(user)=toInt({user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInt({application_id})

    // Enforce privacy
    ${visibility_enforcement}

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
    WITH application, applicant, submitted_by, recipient, submitted_to, approval
    OPTIONAL MATCH (application)<-[rejection:REJECTED]-(recipient)

    // Return everything
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval, rejection

    // Ordering flow
    ORDER BY submitted_to.flow_index DESC
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.query.application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
})

app.get('/application/applicant',check_authentication, (req, res) => {
  // Get the applicant of an application
  // Todo: return a single record
  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:Employee)
    WHERE id(user)=toInt({user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInt({application_id})

    // Enforce privacy
    ${visibility_enforcement}

    // Find applicant
    WITH application
    MATCH (application)-[submitted_by:SUBMITTED_BY]->(applicant:Employee)

    // Return queried items
    RETURN applicant, submitted_by, application

    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.query.application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
})

app.get('/application/recipients',check_authentication, (req, res) => {
  // Get a the recipients of a single application

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:Employee)
    WHERE id(user)=toInt({user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInt({application_id})

    // Enforce privacy
    ${visibility_enforcement}

    // Find applicant (not necessary here but doens't cost much to add in the query)
    WITH application
    OPTIONAL MATCH (application)-[submitted_by:SUBMITTED_BY]->(applicant:Employee)

    // Find recipients
    WITH application, applicant, submitted_by
    OPTIONAL MATCH (application)-[submitted_to:SUBMITTED_TO]->(recipient:Employee)

    // Find approvals
    WITH application, applicant, submitted_by, recipient, submitted_to
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

    // Find rejections
    WITH application, applicant, submitted_by, recipient, submitted_to, approval
    OPTIONAL MATCH (application)<-[rejection:REJECTED]-(recipient)

    // Return everything
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval, rejection

    // Ordering flow
    ORDER BY submitted_to.flow_index DESC
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.query.application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
})

app.get('/application/visibility',check_authentication, (req, res) => {
  // Get a the recipients of a single application

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:Employee)
    WHERE id(user)=toInt({user_id})

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInt({application_id})

    // Enforce privacy
    ${visibility_enforcement}

    // Find groups the application is visible to
    WITH application
    MATCH (application)-[:VISIBLE_TO]->(group:Group)

    // Return
    RETURN group

    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.query.application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
})

app.post('/find_application_by_hanko',check_authentication, (req, res) => {
  // Get a single application using the ID of its approval

  // TODO: Make it a GET request?

  // NOT SECURE!

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
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })


})

app.post('/approve_application',check_authentication, (req, res) => {

  // TODO: Add check for application flow index
  // REALLY?


  var session = driver.session()
  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee)
    WHERE id(application) = toInt({application_id}) AND id(recipient) = toInt({user_id})

    // TODO: Add check if flow is respected

    // Mark as approved
    WITH application, recipient
    MERGE (application)<-[:APPROVED {date: date()}]-(recipient)

    // RETURN APPLICATION
    RETURN application, recipient
    `, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
  })
  .then(result => {
    res.send(result.records)
    console.log(`Application ${result.records[0].get('application').identity.low} got approved by ${result.records[0].get('recipient').identity.low}`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.post('/reject_application',check_authentication, (req, res) => {
  // basically the opposite of putting a hanko

  var session = driver.session()
  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:Employee)
    WHERE id(application) = toInt({application_id}) AND id(recipient) = toInt({user_id})

    // TODO: Add check if flow is respected
    // Working fine without apparently

    // Mark as REJECTED
    WITH application, recipient
    MERGE (application)<-[rejection:REJECTED {date: date()}]-(recipient)
    SET rejection.reason = {reason}

    // RETURN APPLICATION
    RETURN application, recipient`, {
    user_id: res.locals.user.identity.low,
    application_id: req.body.application_id,
    reason: req.body.reason,
  })
  .then(result => {
    res.send(result.records)
    console.log(`Application ${result.records[0].get('application').identity.low} got rejected by ${result.records[0].get('recipient').identity.low}`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})



app.post('/create_application_form_template', check_authentication, (req, res) => {
  // Create application form template
  var session = driver.session()
  session
  .run(`
    // Find creator
    MATCH (creator:Employee)
    WHERE id(creator) = toInt({user_id})
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
    user_id: res.locals.user.identity.low,
    fields: JSON.stringify(req.body.fields),
    label: req.body.label,
    target_id: req.body.target_id,
  })
  .then((result) => {
    res.send(result.records)
    console.log(`Application template ${result.records[0].get('aft').identity.low} created`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})



app.post('/edit_application_form_template', check_authentication, (req, res) => {


  var session = driver.session()
  session
  .run(`
    // Find template
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee)
    WHERE id(aft) = toInt({id}) AND id(creator) = toInt({user_id})

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
    user_id: res.locals.user.identity.low,
    id: req.body.id,
    fields: JSON.stringify(req.body.fields),
    label: req.body.label,
    target_id: req.body.target_id
  })
  .then((result) => {
    res.send(result.records)
    console.log(`Application template ${result.records[0].get('aft').identity.low} got edited`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

})

app.post('/delete_application_form_template', check_authentication, (req, res) => {

  // Delete application form template

  var session = driver.session()
  session
  .run(`
    // Find application
    MATCH (aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee)
    WHERE id(aft) = toInt({id}) AND id(creator) = toInt({user_id})

    // Delete the node
    DETACH DELETE aft

    // RETURN
    RETURN creator`, {
    user_id: res.locals.user.identity.low,
    id: req.body.id,
  })
  .then((result) => {
    res.send(result.records)
    console.log(`Application template ${req.body.id} got deleted`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})


app.get('/all_application_form_templates_visible_to_user', check_authentication, (req, res) => {

  // Create application form template
  var session = driver.session()
  session
  .run(`
    MATCH (creator:Employee)<-[:CREATED_BY]-(aft:ApplicationFormTemplate)-[:VISIBLE_TO]->(g)<-[:BELONGS_TO]-(employee:Employee)
    WHERE id(employee) = toInt({user_id})
    RETURN aft, creator, g`, {
    user_id: res.locals.user.identity.low,
    })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})

app.get('/application_form_templates_from_user', check_authentication, (req, res) => {
  // Get application form template of a the current user
  var session = driver.session()
  session
  .run(`
    // Find creator
    MATCH (g)<-[:VISIBLE_TO]-(aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee)
    WHERE id(creator) = toInt({user_id})

    // RETURN
    RETURN aft, g`, {
    user_id: res.locals.user.identity.low,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})

app.get('/application_form_template', check_authentication, (req, res) => {

  // get a single  application form template
  var session = driver.session()
  session
  .run(`
    MATCH (g)<-[:VISIBLE_TO]-(aft: ApplicationFormTemplate)-[:CREATED_BY]->(creator:Employee)
    WHERE id(aft) = toInt({id})
    RETURN aft, g, creator`, {
    id: req.query.id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
})


app.post('/file_upload',check_authentication, (req, res) => {
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
    });

  });
});

app.get('/file', check_authentication, (req, res) => {

  if(!('file_id' in req.query)) return res.status(400).send('File ID not specified')

  // Application ID not strictly neccessary but helps find the file more easily
  if(!('application_id' in req.query)) return res.status(400).send('Application ID not specified')

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:Employee)
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

    return application
    `, {
    file_id: req.query.file_id,
    application_id: req.query.application_id,
    user_id: res.locals.user.identity.low,
  })
  .then((result) => {
    if(result.records.length === 0) return res.send(400).send('The file cannot be downloaded. Either it does not exist or is private')
    else {

      var directory_path = path.join(uploads_directory_path, req.query.file_id)

      fs.readdir(directory_path, (err, items) => {
        if(err) return res.status(500).send("Error reading uploads directory")
        // Send first file in the directory
        res.download( path.join(directory_path, items[0]),items[0] )
      });

    }
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

});


// Start the server
app.listen(port, () => console.log(`Application form manager listening on 0.0.0.0:${port}`))
