const driver = require('../../neo4j_driver.js')

function get_current_user_id(res) {
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}

const return_application_and_related_nodes =
`
// Dealing with confidentiality
// involves checking relationship to current user

WITH application
MATCH (user:User)
WHERE id(user)=toInteger($user_id)

WITH application,
  application.private
  AND NOT (application)-[:SUBMITTED_BY]->(user)
  AND NOT (application)-[:SUBMITTED_TO]->(user)
  AND NOT (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
AS forbidden

// Find applicant
WITH application, forbidden
OPTIONAL MATCH (application)-[authorship:SUBMITTED_BY]->(applicant:User)

// Find recipients
WITH application, applicant, authorship, forbidden
OPTIONAL MATCH (application)-[submission:SUBMITTED_TO]->(recipient:User)

// Find approvals
WITH application, applicant, authorship, recipient, submission, forbidden
OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

// Find rejections
WITH application, applicant, authorship, recipient, submission, approval, forbidden
OPTIONAL MATCH (application)<-[refusal:REJECTED]-(recipient)

// visibility
WITH application, applicant, authorship, recipient, submission, approval, refusal, forbidden
OPTIONAL MATCH (application)-[:VISIBLE_TO]->(group:Group)
  WHERE application.private = true

// Return everything
RETURN application,
  applicant,
  authorship,
  collect(distinct recipient) as recipients,
  collect(distinct submission) as submissions,
  collect(distinct approval) as approvals,
  collect(distinct refusal) as refusals,
  collect(distinct group) as visibility,
  forbidden
`

function format_application_from_record(record) {

  if(record.get('forbidden')) {
    let application = record.get('application')
    delete application.properties.form_data
    application.properties.title = '機密 / Confidential'
  }

  return {
    ...record.get('application'),
    applicant: {
      ...record.get('applicant'),
      authorship: record.get('authorship')
    },
    visibility: record.get('visibility'),
    recipients: record.get('recipients')
      .map(recipient => ({
        ...recipient,
        submission: record.get('submissions').find(submission => submission.end === recipient.identity ),
        approval: record.get('approvals').find(approval =>   approval.start === recipient.identity ),
        refusal: record.get('refusals').find(refusal => refusal.start === recipient.identity ),
      }))
      .sort( (a,b) => a.submission.properties.flow_index - b.submission.properties.flow_index )
  }
}

exports.get_application = (req, res) => {
  // Get a single application using its ID

  const {application_id} = req.params
  if(!application_id) return res.status(400).send('Application ID not defined')

  const query =
  `
    // Find application
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInteger($application_id)

    ${return_application_and_related_nodes}
  `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
  }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {

    if(records.length < 1) {
      console.log(`Application ${application_id} not found`)
      return res.status(404).send(`Application ${application_id} not found`)
    }

    const record = records[0]

    const application = format_application_from_record(record)

    res.send(application)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

const query_applications_submitted_by_user =
`
MATCH (user:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
WHERE id(user)=toInteger($user_id)
`

const query_applications_submitted_to_user =
`
MATCH (user:User)<-[:SUBMITTED_TO]-(application:ApplicationForm)
WHERE id(user)=toInteger($user_id)
`

const query_submitted_rejected_applications =
`
WITH application
WHERE (:User)-[:REJECTED]->(application)
`

const query_submitted_pending_applications =
`
// A pending application is an application that is does not yet have an equal amount approvals and submissions
// Also, a rejected application is automatiocally not pending
WITH application
MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
WHERE NOT (recipient:User)-[:REJECTED]->(application)
WITH application, COUNT(recipient) AS recipient_count
OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
WITH application, recipient_count, count(approval) as approval_count
WHERE NOT recipient_count = approval_count
`

const query_submitted_approved_applications =
`
// A pending application is an application that is does not yet have an equal amounf approvals and submissions
// Also, a rejected application is automatiocally not pending
WITH application
MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
WHERE NOT (recipient:User)-[:REJECTED]->(application)
WITH application, COUNT(recipient) AS recipient_count
OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
WITH application, recipient_count, count(approval) as approval_count
WHERE recipient_count = approval_count
`

const query_received_pending_applications =
`
// Check if recipient is next in the flow
WITH application

// Get the current user
// Also filter out rejected applications
MATCH (application)-[submission:SUBMITTED_TO]->(user:User)
WHERE id(user)=toInteger($user_id)
AND NOT (application)<-[:REJECTED]-(:User)

// Get the approval count
WITH application, submission
OPTIONAL MATCH (application)<-[approval:APPROVED]-(:User)
WITH submission, application, count(approval) as approval_count
WHERE submission.flow_index = approval_count
`

const query_received_rejected_applications =
`
// Check if recipient is next in the flow
WITH application

// Get the current user
// Also filter out rejected applications
MATCH (application)<-[:REJECTED]->(user:User)
WHERE id(user)=toInteger($user_id)
`

const query_received_approved_applications =
`
// Check if recipient is next in the flow
WITH application

// Get the current user
// Also filter out rejected applications
MATCH (application)<-[:APPROVED]->(user:User)
WHERE id(user)=toInteger($user_id)
`

const application_batching = `
// Batching
WITH collect(application) AS application_collection
WITH application_collection[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS application_batch
UNWIND application_batch AS application
`

const filter_by_type = (type) => {
  let query = ``

  if(type) {
    query = `
    WITH application
    WHERE application.type = $type
    `
  }

  return query

}

exports.get_submitted_pending_applications = (req, res) => {


  const query = `
  // Get applications submitted by user
  ${query_applications_submitted_by_user}

  ${filter_by_type(req.query.type)}

  // Filter only pending
  ${query_submitted_pending_applications}

  // Batching
  ${application_batching}

  // Format and return
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id: get_current_user_id(res),
    start_index: req.query.start_index || 0,
    batch_size: req.query.batch_size || 10,
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_rejected_applications = (req, res) => {

  const query = `
  // Get applications submitted by user
  ${query_applications_submitted_by_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_submitted_rejected_applications}

  // Batching
  ${application_batching}

  // Format and return
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id: get_current_user_id(res),
    start_index: req.query.start_index || 0,
    batch_size: req.query.batch_size || 10,
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_approved_applications = (req, res) => {

  const query = `
  // Get applications submitted by user
  ${query_applications_submitted_by_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_submitted_approved_applications}

  // Batching
  ${application_batching}

  // Format and return
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id: get_current_user_id(res),
    start_index: req.query.start_index || 0,
    batch_size: req.query.batch_size || 10,
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_pending_applications_count = (req, res) => {


  const query = `
  // Get applications submitted by user
  ${query_applications_submitted_by_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_submitted_pending_applications}

  RETURN count(application) as application_count
  `
  const params = {
    user_id: get_current_user_id(res),
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_rejected_applications_count = (req, res) => {

  const query = `
  // Get applications submitted by user
  ${query_applications_submitted_by_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_submitted_rejected_applications}

  RETURN count(application) as application_count
  `
  const params = {
    user_id: get_current_user_id(res),
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_approved_applications_count = (req, res) => {


  const query = `
  // Get applications submitted by user
  ${query_applications_submitted_by_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_submitted_approved_applications}

  RETURN count(application) as application_count
  `
  const params = {
    user_id: get_current_user_id(res),
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}


// RECEIVED


exports.get_received_pending_applications = (req, res) => {


  const query = `
  ${query_applications_submitted_to_user}

  ${filter_by_type(req.query.type)}

  // Filter only pending
  ${query_received_pending_applications}

  // Batching
  ${application_batching}

  // Format and return
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id: get_current_user_id(res),
    start_index: req.query.start_index || 0,
    batch_size: req.query.batch_size || 10,
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_rejected_applications = (req, res) => {

  const query = `
  ${query_applications_submitted_to_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_received_rejected_applications}

  // Batching
  ${application_batching}

  // Format and return
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id: get_current_user_id(res),
    start_index: req.query.start_index || 0,
    batch_size: req.query.batch_size || 10,
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_approved_applications = (req, res) => {

  const query = `
  ${query_applications_submitted_to_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_received_approved_applications}

  // Batching
  ${application_batching}

  // Format and return
  ${return_application_and_related_nodes}
  `
  const params = {
    user_id: get_current_user_id(res),
    start_index: req.query.start_index || 0,
    batch_size: req.query.batch_size || 10,
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const applications = records.map(record => format_application_from_record(record))
    res.send(applications)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_pending_applications_count = (req, res) => {


  const query = `
  ${query_applications_submitted_to_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_received_pending_applications}

  RETURN count(application) as application_count
  `
  const params = {
    user_id: get_current_user_id(res),
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_rejected_applications_count = (req, res) => {

  const query = `
  ${query_applications_submitted_to_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_received_rejected_applications}

  RETURN count(application) as application_count
  `
  const params = {
    user_id: get_current_user_id(res),
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_received_approved_applications_count = (req, res) => {


  const query = `
  ${query_applications_submitted_to_user}

  ${filter_by_type(req.query.type)}

  // Filter only rejected
  ${query_received_approved_applications}

  RETURN count(application) as application_count
  `
  const params = {
    user_id: get_current_user_id(res),
    type: req.query.type,
   }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {
    const application_count = records[0].get('application_count')
    res.send({application_count})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}
