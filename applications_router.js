const driver = require('./neo4j_driver.js')
const express = require('express')
const auth = require('./auth.js')

const router = express.Router()
const submitted_applications_router = express.Router()
const received_applications_router = express.Router()


const visibility_enforcement = `
  WITH user, application
  WHERE NOT application.private
    OR NOT EXISTS(application.private)
    OR (application)-[:SUBMITTED_BY]->(user)
    OR (application)-[:SUBMITTED_TO]->(user)
    OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
`


let get_submitted_applications = (req, res) => {
  // Get all applications submitted by the logged in user
  var session = driver.session()
  session
  .run(`
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
    WHERE id(applicant)=toInt({user_id})

    RETURN application
    ORDER BY application.creation_date DESC
    `, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

let get_submitted_applications_pending = (req, res) => {

  var session = driver.session()
  session
  .run(`
    // Get all submissions of given application
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(e:User)
    WHERE id(applicant)=toInt({user_id})

    // EXCLUDE REJECTS
    WITH application, applicant, submission
    WHERE NOT ()-[:REJECTED]->(application)

    // Get all approvals of the application
    WITH application, applicant, count(submission) as cs
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(:User)

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

}

let get_submitted_applications_approved = (req, res) => {

  var session = driver.session()
  session
  .run(`
    // Get all submissions of given application
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(:User)
    WHERE id(applicant)=toInt({user_id})

    // Get all approvals of the application
    WITH application, applicant, count(submission) as cs
    MATCH (application)<-[approval:APPROVED]-(:User)

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
}


let get_submitted_applications_rejected = (req, res) => {

  var session = driver.session()
  session
  .run(`
    // Get applications submitted by logged user
    MATCH (applicant:User)<-[submitted_by:SUBMITTED_BY]-(application:ApplicationForm)<-[:REJECTED]-(:User)
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

}


let get_received_applications = (req, res) => {
  // Returns applications rceived by the logged in user

  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
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

}

let get_received_applications_pending = (req, res) => {
  // Returns applications submitted to a user but not yet approved
  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
    WHERE id(recipient)=toInt({user_id})
      AND NOT (application)<-[:APPROVED]-(recipient)
      AND NOT (application)<-[:REJECTED]-(recipient)


    // Check if recipient is next in the flow
    WITH application, recipient, submission, applicant
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(:User)

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

}


let get_received_applications_approved = (req, res) => {
  // Returns applications approved by a user

  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)<-[:APPROVED]-(recipient:User)
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

}


let get_received_applications_rejected = (req, res) => {
  // Returns applications rejected by a user

  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    MATCH (applicant)<-[:SUBMITTED_BY]-(application:ApplicationForm)<-[:REJECTED]-(recipient:User)
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

}


// Submitted applications
submitted_applications_router.route('/').get(get_submitted_applications)
submitted_applications_router.route('/pending').get(get_submitted_applications_pending)
submitted_applications_router.route('/approved').get(get_submitted_applications_approved)
submitted_applications_router.route('/rejected').get(get_submitted_applications_rejected)

// Received applications
received_applications_router.route('/').get(get_received_applications)
received_applications_router.route('/pending').get(get_received_applications_pending)
received_applications_router.route('/approved').get(get_received_applications_approved)
received_applications_router.route('/rejected').get(get_received_applications_rejected)

router.use(auth.check_auth)

router.use('/submitted', submitted_applications_router)
router.use('/received', received_applications_router)

module.exports = router
