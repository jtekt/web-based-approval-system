const {driver} = require('../../db.js')
const {
  get_current_user_id,
  error_handling,
  //return_application_and_related_nodes,
  format_application_from_record,
  query_submitted_rejected_applications,
  query_submitted_pending_applications,
  query_submitted_approved_applications,
  query_received_pending_applications,
  query_received_rejected_applications,
  query_received_approved_applications,
} = require('../../utils.js')



// IMPORTANTL THIS IS A SPECIAL VERSION DEDICATED TO THIS CONTROLLER BECAUSE IT INCLUDES COUND
const application_batching = `
// Batching does the count!
WITH application ORDER BY application.creation_date DESC
WITH collect(application) AS application_collection, count(application) as application_count
WITH application_count, application_collection[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS application_batch
UNWIND application_batch AS application
`

// IMPORTANT: THIS IS A SPECIAL VERSION
const return_application_and_related_nodes = `
// Batching does the count!
WITH application, application_count
MATCH (user:User)
WHERE id(user)=toInteger($user_id)

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
RETURN application,
  applicant,
  authorship,
  collect(distinct recipient) as recipients,
  collect(distinct submission) as submissions,
  collect(distinct approval) as approvals,
  collect(distinct refusal) as refusals,
  collect(distinct group) as visibility,
  forbidden,
  application_count
`



const query_with_relationship = (relationship_type) => {
  if(!relationship_type) return ``

  const relationship_types = ['APPROVED', 'REJECTED', 'SUBMITTED_BY', 'SUBMITTED_TO']
  if(relationship_to_user && !relationship_types.includes(relationship_to_user)){
    throw {code:400, message: `${relationship_types} is not a valid relationship type`}
  }

  return `
  WITH application, user
  MATCH (application)-[r]-(user)
  WHERE type(r) = $relationship_type
    AND id(user) = toInteger($user_id)
  `
}

const query_with_hanko_id = (hanko_id) => {
  if(!hanko_id) return ``
  return `
  WITH application
  MATCH (application)-[r:APPROVED]-(:User)
  WHERE id(r) = toInteger($hanko_id)
  `
}

const query_with_application_id = (application_id) => {
  if(!application_id) return ``
  return `
  WITH application
  WHERE id(application) = toInteger($application_id)
  `
}

const query_with_start_date = (start_date) => {
  if(!start_date) return ``
  return `
  WITH application
  WHERE application.creation_date >= date($start_date)
  `
}

const query_with_end_date = (end_date) => {
  if(!end_date) return ``
  return `
  WITH application
  WHERE application.creation_date <= date($end_date)
  `
}

const query_with_group = (group_id) => {
  if(!group_id) return ``
  return `
  WITH application
  MATCH (application)-[:SUBMITTED_BY]->(:User)-[:BELONGS_TO]->(group:Group)
  WHERE id(group) = toInteger($group_id)
  `
}

const query_with_type = (type) => {
  // a bit loose
  if(!type) return ``
  return `
  WITH application
  WHERE toLower(application.type) CONTAINS toLower($type)
  `
}

const query_deleted = (deleted) => {
  // Returns deleted applications if specified so
  if(deleted) return ``
  return `
  WITH application
  WHERE NOT EXISTS(application.deleted)
  `
}


const query_with_relationship_and_state = (relationship, state) => {

  // no need to go further if no relationship provided
  // maybe...
  if(!relationship) return ``

  // base query with relationship
  let query = `
  WITH application, user
  MATCH (application)-[r]-(user)
  WHERE type(r) = $relationship
    AND id(user) = toInteger($user_id)
  `

  if(relationship === 'SUBMITTED_BY') {
    if(state === 'pending') query += query_submitted_pending_applications
    else if (state === 'rejected') query += query_submitted_rejected_applications
    else if (state === 'approved') query += query_submitted_approved_applications
    else throw {code: 400, error: `Invalid query: ${relationship} ${state}`}
  }
  else if(relationship === 'SUBMITTED_TO'){
    // a.k.a received
    if(state === 'pending') query += query_received_pending_applications
    else if (state === 'rejected') query +=  query_received_rejected_applications
    else if (state === 'approved') query += query_received_approved_applications
    else throw {code: 400, error: `Invalid query: ${relationship} ${state}`}
  }
  else throw {code: 400, error: `Invalid relationship: ${relationship}`}

  return query

}



exports.get_applications = async (req,res) => {

  // get applications according to specific filters


  // Idea, could think of having submitted_by: <user id>

  const current_user_id = get_current_user_id(res)

  const {
    user_id = current_user_id, /// by default, focuses on current user
    group_id,
    relationship,
    state, // approved,
    type,
    start_date,
    end_date,
    application_id, // redudant with GET /applications/:application_id
    hanko_id,
    start_index = 0,
    batch_size = 10,
    deleted = false,
  } = req.query

  const session = driver.session()
  try {

    const query = `
    MATCH (user:User)
    WHERE id(user)=toInteger($user_id)
    WITH user
    MATCH (application:ApplicationForm)
    ${query_with_relationship_and_state(relationship,state)}

    // from here on, no need for user anymore
    // gets requeried later on
    ${query_deleted(deleted)}
    ${query_with_type(type)}
    ${query_with_end_date(end_date)}
    ${query_with_start_date(start_date)}
    ${query_with_group(group_id)}
    ${query_with_hanko_id(hanko_id)}

    // Batching does the count
    ${application_batching}
    ${return_application_and_related_nodes}
    `

    const params = {
      user_id,
      relationship,
      type,
      start_date,
      end_date,
      start_index,
      batch_size,
    }

    const {records} = await session.run(query, params)

    const count = records.length ?  records[0].get('application_count') : 0

    const applications = records.map(record => format_application_from_record(record))

    res.send({
      count,
      applications,
      start_index,
      batch_size
    })




  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }




}
