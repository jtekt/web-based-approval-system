const driver = require('../../neo4j_driver.js')

const visibility_enforcement = `
  WITH user, application
  WHERE NOT application.private
    OR NOT EXISTS(application.private)
    OR (application)-[:SUBMITTED_BY]->(user)
    OR (application)-[:SUBMITTED_TO]->(user)
    OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
`

function get_current_user_id(res) {
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}

function get_application_id(req) {
  return req.params.application_id
    ?? req.body.application_id
    ?? req.body.id
    ?? req.query.application_id
    ?? req.query.id
}




exports.get_application = (req, res) => {
  // Get a single application using its ID

  const application_id = get_application_id(req)
  if(!application_id) return res.status(400).send('Application ID not defined')

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:User)
    WHERE id(user)=toInteger($user_id)

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE id(application) = toInteger($application_id)

    // Dealing with confidentiality
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
    `, {
    user_id: get_current_user_id(res),
    application_id,
  })
  .then( ({records}) => {

    if(records.length < 1) {
      console.log(`Application ${application_id} not found`)
      return res.status(404).send(`Application ${application_id} not found`)
    }

    const record = records[0]

    if(record.get('forbidden')) {
      let application = record.get('application')
      delete application.properties.form_data
      application.properties.title = '機密 / Confidential'
    }

    const application = {
      ...record.get('application'),
      applicant: {
        ...record.get('applicant'),
        authorship: record.get('authorship')
      },
      visibility: record.get('visibility'),
    }

    application.recipients = record.get('recipients')
    .map(recipient => {
      return {
        ...recipient,
        submission: record.get('submissions').find(submission => submission.end === recipient.identity ),
        approval: record.get('approvals').find(approval =>   approval.start === recipient.identity ),
        refusal: record.get('refusals').find(refusal => refusal.start === recipient.identity ),
      }
    })
    // Sort by flow index
    .sort( (a,b) => {
      return a.submission.properties.flow_index - b.submission.properties.flow_index
    })

    res.send(application)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}
