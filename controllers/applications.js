const driver = require('../neo4j_driver.js')

const visibility_enforcement = `
  WITH user, application
  WHERE NOT application.private
    OR NOT EXISTS(application.private)
    OR (application)-[:SUBMITTED_BY]->(user)
    OR (application)-[:SUBMITTED_TO]->(user)
    OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
`

exports.create_application = (req, res) => {
  // Route to create or edit an application

  var session = driver.session();
  session
  .run(`
    // Create the application node
    MATCH (s:User)
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
    MATCH (r:User)
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
}

exports.delete_application = (req, res) => {
  // Deleting an application
  // Only the creator can delete the application

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

  var session = driver.session()
  session
  .run(`
    // Find the application to be deleted using provided id
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(a:ApplicationForm)
    WHERE id(a) = toInt({application_id})
      AND id(applicant)=toInt({user_id})

    // Delete the application and all of its relationships
    DETACH DELETE a
    `, {
    user_id: res.locals.user.identity.low,
    application_id: application_id,
  })
  .then(result => {
    res.send(result.records)
    console.log(`Application ${application_id} deleted`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.get_application = (req, res) => {
  // Get a single application using its ID

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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

    // Enforce privacy
    ${visibility_enforcement}

    // Find applicant
    // (not necessary here but doesn't cost much to add in the query)
    WITH application
    OPTIONAL MATCH (application)-[submitted_by:SUBMITTED_BY]->(applicant:User)

    // Find recipients
    // TODO: This should now be done using the /application/recipients route
    WITH application, applicant, submitted_by
    OPTIONAL MATCH (application)-[submitted_to:SUBMITTED_TO]->(recipient:User)

    // Find approvals
    // TODO: This should now be done using the /application/recipients route
    WITH application, applicant, submitted_by, recipient, submitted_to
    OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

    // Find rejections
    // TODO: This should now be done using the /application/recipients route
    WITH application, applicant, submitted_by, recipient, submitted_to, approval
    OPTIONAL MATCH (application)<-[rejection:REJECTED]-(recipient)

    // Return everything
    RETURN application, applicant, submitted_by, recipient, submitted_to, approval, rejection

    // Ordering flow
    ORDER BY submitted_to.flow_index DESC
    `, {
    user_id: res.locals.user.identity.low,
    application_id: application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.update_attachment_hankos = (req, res) => {
  
  let approval_id = req.params.approval_id
    || req.body.approval_id
    || req.body.id

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:User)-[approval:APPROVED]->(application:ApplicationForm)
    WHERE id(user)=toInt({user_id})
      AND id(approval) = toInt({approval_id})

    // Set the attached hankos
    SET approval.attachment_hankos = {attachment_hankos}

    // Return
    RETURN application, approval

    `, {
    user_id: res.locals.user.identity.low,
    approval_id: approval_id,
    attachment_hankos: JSON.stringify(req.body.attachment_hankos), // Neo4J does not support nested props so convert to string
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })



}

exports.get_application_applicant = (req, res) => {
  // Get the applicant of an application

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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

    // Enforce privacy
    ${visibility_enforcement}

    // Find applicant
    WITH application
    MATCH (application)-[submitted_by:SUBMITTED_BY]->(applicant:User)

    // Return queried items
    RETURN applicant, submitted_by, application

    `, {
    user_id: res.locals.user.identity.low,
    application_id: application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.get_application_recipients = (req, res) => {
  // Get a the recipients of a single application

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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

    // Enforce privacy
    ${visibility_enforcement}

    // Find applicant (not necessary here but doens't cost much to add in the query)
    WITH application
    OPTIONAL MATCH (application)-[submitted_by:SUBMITTED_BY]->(applicant:User)

    // Find recipients
    WITH application, applicant, submitted_by
    OPTIONAL MATCH (application)-[submitted_to:SUBMITTED_TO]->(recipient:User)

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
    application_id: application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.get_application_visibility = (req, res) => {
  // Get a the groups an application is visible to

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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

    // Enforce privacy
    ${visibility_enforcement}

    // Find groups the application is visible to
    WITH application
    MATCH (application)-[:VISIBLE_TO]->(group:Group)

    // Return
    RETURN group

    `, {
    user_id: res.locals.user.identity.low,
    application_id: application_id,
  })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.approve_application = (req, res) => {

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

  var session = driver.session()
  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
    WHERE id(application) = toInt({application_id})
      AND id(recipient) = toInt({user_id})

    // TODO: Add check if flow is respected

    // Mark as approved
    WITH application, recipient
    MERGE (application)<-[:APPROVED {date: date()}]-(recipient)

    // RETURN APPLICATION
    RETURN application, recipient
    `, {
    user_id: res.locals.user.identity.low,
    application_id: application_id,
  })
  .then(result => {
    res.send(result.records)
    console.log(`Application ${result.records[0].get('application').identity.low} got approved by ${result.records[0].get('recipient').identity.low}`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.reject_application = (req, res) => {
  // basically the opposite of putting a hanko

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

  var session = driver.session()
  session
  .run(`
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
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
    application_id: application_id,
    reason: req.body.reason,
  })
  .then(result => {
    res.send(result.records)
    console.log(`Application ${result.records[0].get('application').identity.low} got rejected by ${result.records[0].get('recipient').identity.low}`)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.update_privacy_of_application = (req, res) => {
  // Route to create or edit an application

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

  var session = driver.session()
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
    application_id: application_id,
    private: req.body.private,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.update_application_visibility = (req, res) => {
  // Deletes all relationships to groups and recreate them

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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
    application_id: application_id,
    group_ids: req.body.group_ids,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}


exports.make_application_visible_to_group = (req, res) => {
  // Deletes all relationships to groups and recreate them

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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
    application_id: application_id,
    group_id: req.body.group_id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}

exports.remove_application_visibility_to_group = (req, res) => {
  // Deletes all relationships to groups and recreate them

  let application_id = req.params.application_id
    || req.body.application_id
    || req.body.id
    || req.query.application_id
    || req.query.id

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
    application_id: application_id,
    group_id: req.query.group_id,
  })
  .then((result) => { res.send(result.records) })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}


exports.find_application_id_by_hanko = (req, res) => {
  // Get a single application using the ID of its approval

  // NOT SECURE!

  var session = driver.session()
  session
  .run(`
    // Find application and applicant
    MATCH (application:ApplicationForm)<-[approval:APPROVED]-()
    WHERE id(approval) = toInt({approval_id})

    // Return everything
    RETURN id(application) as id
    `, {
    approval_id: req.query.approval_id,
  })
  .then(result => {
    if(result.records.length < 1) return res.status(404).send(`Application not found`)
    res.send({id: result.records[0].get('id').low})
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}

exports.get_submitted_applications = (req, res) => {
  // Get all applications submitted by the logged in user

  // UNUSED

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

exports.get_submitted_applications_pending = (req, res) => {

  let query = `
  // Get applications of applicant
  MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
  WHERE id(applicant)=toInteger({user_id})

  // Filter out rejects
  WITH application, applicant
  WHERE NOT (:User)-[:REJECTED]->(application)

  // Get submission_count and approval_count
  WITH application, applicant
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WITH application, applicant, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, applicant, recipient_count, count(approval) as approval_count

  // Filter out completed applications
  WITH application, applicant, recipient_count, approval_count
  WHERE NOT recipient_count = approval_count

  // Find next recipient
  WITH application, applicant, recipient_count, approval_count
  MATCH (application)-[submission:SUBMITTED_TO]->(next_recipient:User)
  WHERE submission.flow_index = approval_count

  RETURN application, recipient_count, approval_count, next_recipient
  ORDER BY application.creation_date DESC
  `

  var session = driver.session()
  session
  .run(query, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => {res.send(result.records)})
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}

exports.get_submitted_applications_approved = (req, res) => {

  let query = `
  // Get applications of applicant
  MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
  WHERE id(applicant)=toInteger({user_id})

  // Filter out rejects
  WITH application, applicant
  WHERE NOT (:User)-[:REJECTED]->(application)

  // Get submission_count and approval_count
  WITH application, applicant
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WITH application, applicant, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, applicant, recipient_count, count(approval) as approval_count

  // Filter out completed applications
  WITH application, applicant, recipient_count, approval_count
  WHERE recipient_count = approval_count

  RETURN application, recipient_count, approval_count
  ORDER BY application.creation_date DESC
  `

  var session = driver.session()
  session
  .run(query, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => {
    // THIS SHOULD BE RECORDS!
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })
}


exports.get_submitted_applications_rejected = (req, res) => {

  let query = `
  // Get applications of applicant
  MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
  WHERE id(applicant)=toInteger({user_id})

  // Filter out rejects
  WITH application, applicant
  WHERE (:User)-[:REJECTED]->(application)

  // Get submission_count and approval_count
  WITH application, applicant
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WITH application, applicant, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, applicant, recipient_count, count(approval) as approval_count

  // Find next recipient (recipient who rejected the application)
  WITH application, applicant, recipient_count, approval_count
  MATCH (application)-[submission:SUBMITTED_TO]->(next_recipient:User)
  WHERE submission.flow_index = approval_count

  RETURN application, recipient_count, approval_count, next_recipient
  ORDER BY application.creation_date DESC
  `

  var session = driver.session()
  session
  .run(query, {
    user_id: res.locals.user.identity.low,
  })
  .then(result => {
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error accessing DB: ${error}`) })
  .finally(() => { session.close() })

}


exports.get_received_applications = (req, res) => {
  // Returns applications rceived by the logged in user

  // UNUSED

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

exports.get_received_applications_pending = (req, res) => {
  // Returns applications submitted to a user but not yet approved
  var session = driver.session()
  session
  .run(`
    // Get applications submitted to logged user
    // The application must be neither approved nor rejected by the recpient
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


exports.get_received_applications_approved = (req, res) => {
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


exports.get_received_applications_rejected = (req, res) => {
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
