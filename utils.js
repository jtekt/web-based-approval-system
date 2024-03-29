exports.get_current_user_id = (res) => {
  const user = res.locals?.user
  if (!user) throw `User is not authenticated`

  const user_id = res.locals.user._id ?? res.locals.user.properties._id
  // ?? res.locals.user.identity.low
  // ?? res.locals.user.identity

  if (!user_id) throw `User does not have an ID`

  // converting to string just to be sure
  return user_id.toString()
}

exports.get_application_id = (req) => {
  // Prrobably unused now

  const application_id =
    req.params.application_id ??
    req.body.application_id ??
    req.body.id ??
    req.query.application_id ??
    req.query.id

  // Just in case
  return application_id.toString()
}

exports.format_application_from_record = (record) => {
  // An utility function to format the output of a neo4j query of applications
  // In order to be sent to a front end via JSON

  if (record.get("forbidden")) {
    const application = record.get("application")
    delete application.properties.form_data
    application.properties.title = "機密 / Confidential"
  }

  return {
    ...record.get("application"),
    applicant: {
      ...record.get("applicant"),
      authorship: record.get("authorship"),
    },
    visibility: record.get("visibility"),
    recipients: record
      .get("recipients")
      .map((recipient) => ({
        ...recipient,
        submission: record
          .get("submissions")
          .find((submission) => submission.end === recipient.identity),
        approval: record
          .get("approvals")
          .find((approval) => approval.start === recipient.identity),
        refusal: record
          .get("refusals")
          .find((refusal) => refusal.start === recipient.identity),
      }))
      .sort(
        (a, b) =>
          a.submission.properties.flow_index -
          b.submission.properties.flow_index
      ),
    forbidden: record.get("forbidden"),
  }
}

exports.format_application_from_record_v2 = (record) => {
  // An utility function to format the output of a neo4j query of applications
  // In order to be sent to a front end via JSON

  if (record.get("forbidden")) {
    const application = record.get("application")
    delete application.form_data
    application.title = "機密 / Confidential"
  }

  return {
    ...record.get("application"),
    applicant: {
      ...record.get("applicant"),
      authorship: record.get("authorship"),
    },
    visibility: record.get("visibility"),
    recipients: record
      .get("recipients")
      .map((recipient) => ({
        ...recipient.properties,
        submission: record
          .get("submissions")
          .find((submission) => submission.end === recipient.identity)
          ?.properties,
        approval: record
          .get("approvals")
          .find((approval) => approval.start === recipient.identity)
          ?.properties,
        refusal: record
          .get("refusals")
          .find((refusal) => refusal.start === recipient.identity)?.properties,
      }))
      .sort((a, b) => a.submission.flow_index - b.submission.flow_index),
    forbidden: record.get("forbidden"),
  }
}

const filter_by_applcation_id = `WHERE application._id = $application_id`
exports.filter_by_applcation_id = filter_by_applcation_id

const filter_by_user_id = `WHERE user._id = $user_id`
exports.filter_by_user_id = filter_by_user_id

exports.return_application_and_related_nodes = `
  // application and count provided by batching
  WITH application, application_count
  MATCH (user:User {_id: $user_id})

  // Adding a forbidden flag to applications that the user cannot see
  WITH application, application_count,
    application.private
    AND NOT (application)-[:SUBMITTED_BY]->(user)
    AND NOT (application)-[:SUBMITTED_TO]->(user)
    AND NOT (application)-[:VISIBLE_TO]->(user)
    AND NOT (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
  AS forbidden

  // Find applicant
  WITH application, forbidden, application_count
  OPTIONAL MATCH (application)-[authorship:SUBMITTED_BY]->(applicant:User)

  // Find recipients
  WITH application, applicant, authorship, forbidden, application_count
  OPTIONAL MATCH (application)-[submission:SUBMITTED_TO]->(recipient:User)

  // Find approvals
  WITH application, applicant, authorship, recipient, submission, forbidden, application_count
  OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

  // Find rejections
  WITH application, applicant, authorship, recipient, submission, approval, forbidden, application_count
  OPTIONAL MATCH (application)<-[refusal:REJECTED]-(recipient)

  // visibility
  WITH application, applicant, authorship, recipient, submission, approval, refusal, forbidden, application_count
  OPTIONAL MATCH (application)-[:VISIBLE_TO]->(group:Group)
    WHERE application.private = true

  // Return everything
  RETURN application,
    applicant,
    authorship,
    COLLECT(DISTINCT recipient) as recipients,
    COLLECT(DISTINCT submission) as submissions,
    COLLECT(DISTINCT approval) as approvals,
    COLLECT(DISTINCT refusal) as refusals,
    COLLECT(DISTINCT group) as visibility,
    forbidden,
    application_count
  `

// TODO: Try to format output better
exports.return_application_and_related_nodes_v2 = `
  // application and count provided by batching
  WITH application, application_count
  MATCH (user:User {_id: $user_id})

  // Adding a forbidden flag to applications that the user cannot see
  WITH application, application_count,
    application.private
    AND NOT (application)-[:SUBMITTED_BY]->(user)
    AND NOT (application)-[:SUBMITTED_TO]->(user)
    AND NOT (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
  AS forbidden

  // Find applicant
  WITH application, forbidden, application_count
  OPTIONAL MATCH (application)-[authorship:SUBMITTED_BY]->(applicant:User)

  // Find recipients
  WITH application, applicant, authorship, forbidden, application_count
  OPTIONAL MATCH (application)-[submission:SUBMITTED_TO]->(recipient:User)

  // Find approvals
  WITH application, applicant, authorship, recipient, submission, forbidden, application_count
  OPTIONAL MATCH (application)<-[approval:APPROVED]-(recipient)

  // Find rejections
  WITH application, applicant, authorship, recipient, submission, approval, forbidden, application_count
  OPTIONAL MATCH (application)<-[refusal:REJECTED]-(recipient)

  // visibility
  WITH application, applicant, authorship, recipient, submission, approval, refusal, forbidden, application_count
  OPTIONAL MATCH (application)-[:VISIBLE_TO]->(group:Group)
    WHERE application.private = true

  // Return everything
  RETURN PROPERTIES(application) as application,
    PROPERTIES (applicant) as applicant,
    PROPERTIES (authorship) as authorship,
    COLLECT(DISTINCT PROPERTIES(group)) as visibility,
    // NOTE: Properties not used on the four hereunder
    COLLECT(DISTINCT recipient) as recipients,
    COLLECT(DISTINCT submission) as submissions,
    COLLECT(DISTINCT approval) as approvals,
    COLLECT(DISTINCT refusal) as refusals,
    forbidden,
    application_count

  `

// This might be unused
exports.visibility_enforcement = `
WITH user, application
WHERE application.private IS NULL
  OR NOT application.private
  OR (application)-[:SUBMITTED_BY]->(user)
  OR (application)-[:SUBMITTED_TO]->(user)
  OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
`

const query_submitted_rejected_applications = `
  WITH application
  WHERE (:User)-[:REJECTED]->(application)
  `
exports.query_submitted_rejected_applications =
  query_submitted_rejected_applications

const query_submitted_pending_applications = `
  // A pending application is an application that is does not yet have an equal amount approvals and submissions
  // Also, a rejected application is automatiocally not pending
  WITH application
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WHERE NOT (:User)-[:REJECTED]->(application)
  WITH application, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, recipient_count, count(approval) as approval_count
  WHERE NOT recipient_count = approval_count
  `
exports.query_submitted_pending_applications =
  query_submitted_pending_applications

const query_submitted_approved_applications = `
  // A submitted approved application has equal number of approvals than submissions
  WITH application
  MATCH (application)-[:SUBMITTED_TO]->(recipient:User)
  WHERE NOT (recipient:User)-[:REJECTED]->(application)
  WITH application, COUNT(recipient) AS recipient_count
  OPTIONAL MATCH (:User)-[approval:APPROVED]->(application)
  WITH application, recipient_count, count(approval) as approval_count
  WHERE recipient_count = approval_count
  `
exports.query_submitted_approved_applications =
  query_submitted_approved_applications

const query_received_pending_applications = `
  // Check if recipient is next in the flow
  WITH application

  // Get the current user
  // Also filter out rejected applications
  MATCH (application)-[submission:SUBMITTED_TO]->(user:User {_id: $user_id})
  WHERE NOT (application)<-[:REJECTED]-(:User)

  // Get the approval count
  WITH application, submission
  OPTIONAL MATCH (application)<-[approval:APPROVED]-(:User)
  WITH submission, application, count(approval) as approval_count
  WHERE submission.flow_index = approval_count
  `
exports.query_received_pending_applications =
  query_received_pending_applications

const query_received_rejected_applications = `
  // Check if recipient is next in the flow
  WITH application

  // Get the current user
  // Also filter out rejected applications
  MATCH (application)<-[:REJECTED]->(user:User {_id: $user_id})
  `
exports.query_received_rejected_applications =
  query_received_rejected_applications

const query_received_approved_applications = `
  // Check if recipient is next in the flow
  WITH application

  // Get the current user
  // Also filter out rejected applications
  MATCH (application)<-[:APPROVED]->(user:User {_id: $user_id})
  `
exports.query_received_approved_applications =
  query_received_approved_applications

exports.application_batching = `
  // Counting must be done before batching
  WITH application ORDER BY application.creation_date DESC
  WITH collect(application) AS application_collection, count(application) as application_count
  WITH application_count, application_collection[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS application_batch
  UNWIND application_batch AS application
  `

exports.filter_by_type = (type) => {
  if (!type) return ``
  return `
    WITH application
    WHERE application.type = $type
    `
}

exports.query_with_hanko_id = (hanko_id) => {
  if (!hanko_id) return ``
  return `
    WITH application
    MATCH (application)-[approval:APPROVED]-(:User)
    WHERE approval._id = $hanko_id
      OR id(approval) = toInteger($hanko_id) // temporary
    `
}

exports.query_with_application_id = (application_id) => {
  if (!application_id) return ``
  return `
    WITH application
    ${filter_by_applcation_id}
    `
}

exports.query_with_date = (start_date, end_date) => {
  let query = ``

  if (start_date)
    query += `
    WITH application
    WHERE application.creation_date >= date($start_date)
    `

  if (end_date)
    query += `
    WITH application
    WHERE application.creation_date <= date($end_date)
    `

  return query
}

exports.query_with_group = (group_id) => {
  if (!group_id) return ``
  return `
    WITH application
    MATCH (application)-[:SUBMITTED_BY]->(:User)-[:BELONGS_TO]->(group:Group {_id: $group_id})
    `
}

exports.query_deleted = (deleted) => {
  // Returns deleted applications if specified so
  if (deleted) return ``
  return `
    WITH application
    WHERE application.deleted IS NULL
    `
}

exports.query_with_relationship_and_state = (relationship, state) => {
  // no need to go further if no relationship provided
  // maybe...
  if (!relationship) return ``

  // base query with relationship
  let query = `
    WITH application, user
    MATCH (application)-[r]-(user {_id: $user_id})
    WHERE type(r) = $relationship
    `

  if (relationship === "SUBMITTED_BY") {
    if (state === "pending") query += query_submitted_pending_applications
    else if (state === "rejected")
      query += query_submitted_rejected_applications
    else if (state === "approved")
      query += query_submitted_approved_applications
  } else if (relationship === "SUBMITTED_TO") {
    // a.k.a received
    if (state === "pending") query += query_received_pending_applications
    else if (state === "rejected") query += query_received_rejected_applications
    else if (state === "approved") query += query_received_approved_applications
  }

  return query
}
