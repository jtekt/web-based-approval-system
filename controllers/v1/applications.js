const { driver } = require('../../db.js')
const createError = require('http-errors')
const { v4: uuidv4 } = require('uuid')
const {
  get_current_user_id,
  get_application_id,
  filter_by_user_id,
  filter_by_applcation_id,
  application_batching,
  return_application_and_related_nodes,
  format_application_from_record,
  filter_by_type,
  query_with_hanko_id,
  query_with_application_id,
  query_with_date,
  query_with_group,
  query_deleted,
  query_with_relationship_and_state,
} = require('../../utils.js')



exports.create_application = (req, res, next) => {
  // Create an application form

  const session = driver.session()

  // parsing body
  const {
    type,
    title,
    form_data,
    recipients_ids,
    private = false,
    group_ids = [],
  } = req.body

  const user_id = get_current_user_id(res)

  const query = `
    // Create the application node
    MATCH (user:User)
    ${filter_by_user_id}
    CREATE (application:ApplicationForm)-[:SUBMITTED_BY {date: date()} ]->(user)

    // Set the application properties using data passed in the request body
    SET application._id = randomUUID()
    SET application.creation_date = date()
    SET application.title = $title
    SET application.private = $private
    SET application.form_data = $form_data
    SET application.type = $type

    // Relationship with recipients
    // This also creates flow indices
    // Note: flow cannot be empty
    WITH application, $recipients_ids as recipients_ids
    UNWIND range(0, size(recipients_ids)-1) as i
    MATCH (recipient:User)
    WHERE recipient._id = toString(recipients_ids[i])
    CREATE (recipient)<-[:SUBMITTED_TO {date: date(), flow_index: i} ]-(application)

    // Groups to which the aplication is visible
    // Note: can be an empty set so the logic to deal with it looks terrible
    WITH application
    UNWIND
      CASE
        WHEN $group_ids = []
          THEN [null]
        ELSE $group_ids
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE group._id = group_id
    WITH collect(group) as groups, application
    FOREACH(group IN groups | MERGE (application)-[:VISIBLE_TO]->(group))

    // Finally, Return the created application
    RETURN application
    `

  const params = {
    user_id,
    type,
    title,
    recipients_ids,
    private,
    group_ids,
    form_data: JSON.stringify(form_data), // Neo4J does not support nested props so convert to string
  }


  session
    .run(query,params)
    .then( ({records}) => {
      if(!records.length) throw createError(500, `Failed to create the application`)
      const application = records[0].get('application')
      console.log(`Application ${application.properties._id} created`)
      res.send(application)
    })
    .catch(next)
    .finally(() => { session.close() })
}



exports.get_applications = (req, res, next) => {

  // get applications according to specific filters


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

  const query = `
  MATCH (user:User {_id: $user_id})
  WITH user
  MATCH (application:ApplicationForm)
  ${query_with_relationship_and_state(relationship,state)}

  // from here on, no need for user anymore
  // gets requeried later on
  ${query_deleted(deleted)}
  ${filter_by_type(type)}
  ${query_with_date(start_date,end_date)}
  ${query_with_group(group_id)}
  ${query_with_hanko_id(hanko_id)}
  ${query_with_application_id(application_id)}

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
    application_id,
    hanko_id,
    group_id,
  }

  session
    .run(query, params)
    .then( ({records}) => {

      const count = records.length ?  records[0].get('application_count') : 0

      const applications = records.map(record => format_application_from_record(record))

      res.send({
        count,
        applications,
        start_index,
        batch_size
      })

    })
    .catch(next)
    .finally(() => { session.close() })

}

exports.get_application_types = (req, res, next) => {

  // Used for search

  const session = driver.session()

  const query = `
    // Find applications
    MATCH (application:ApplicationForm)

    // Return the application count
    RETURN distinct(application.type) as application_type
    `

  const params = {}

  session
    .run(query, params)
    .then( ({records}) => {
      const types = records.map(record => record.get('application_type'))
      res.send(types)
    })
    .catch(next)
    .finally(() => { session.close() })
}


exports.get_application = (req, res, next) => {

  // Get a single application using its ID

  const user_id = get_current_user_id(res)
  const {application_id} = req.params

  if(!user_id) throw createError(400, 'User ID not defined')
  if(!application_id) throw createError(400, 'Application ID not defined')

  const query = `
    // Find application
    MATCH (application:ApplicationForm)
    ${filter_by_applcation_id}
      AND NOT EXISTS(application.deleted)

    // Dummy application_count because following query uses it
    WITH application, 1 as application_count
    ${return_application_and_related_nodes}
    `

  const params = { user_id, application_id }

  const session = driver.session()
  session.run(query, params)
  .then( ({records}) => {

    const record = records[0]

    if(!record) throw createError(404, `Application ${application_id} not found`)

    const application = format_application_from_record(record)

    console.log(`Application ${application_id} queried by user ${user_id}`)
    res.send(application)
  })
  .catch(next)
  .finally(() => { session.close() })
}

exports.delete_application = (req, res, next) => {
  // Deleting an application
  // Only the creator can delete the application
  // Applications are not actually deleted, just flagged as so


  const user_id = get_current_user_id(res)
  if(!user_id) throw createError(400, 'User ID not defined')

  const application_id = get_application_id(req)
  if(!application_id) throw createError(400, 'Application ID not defined')

  const session = driver.session()

  const query = `
    // Only the applicant can delete an application
    MATCH (applicant:User)<-[:SUBMITTED_BY]-(application:ApplicationForm)
    ${filter_by_applcation_id}
    AND applicant._id = $user_id

    // flag as deleted
    SET application.deleted = True

    RETURN application
    `

  const params = {user_id, application_id}

  session.run(query,params)
  .then(({records}) => {

    if(!records.length) throw createError(404, `Application ${application_id} not found`)

    const application = records[0].get('application')

    res.send(application)
    console.log(`Application ${application_id} marked as deleted`)
  })
  .catch(next)
  .finally(() => { session.close() })
}


exports.get_application_visibility = (req, res, next) => {
  // Get a the groups an application is visible to

  // Actually used!
  // WHERE? WHY?

  const application_id = get_application_id(req)
  if(!application_id) throw createError(400, 'Application ID not defined')

  const session = driver.session()

  const query = `
    // Find current user to check for authorization
    MATCH (user:User)
    ${filter_by_user_id}

    // Find application and applicant
    WITH user
    MATCH (application:ApplicationForm)
    WHERE application._id = $application_id

    // Enforce privacy
    // REMOVED

    // Find groups the application is visible to
    WITH application
    MATCH (application)-[:VISIBLE_TO]->(group:Group)

    // Return
    RETURN group

    `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
  }

  session.run(query, params)
    .then( ({records}) => {
      res.send(records)
    })
    .catch(next)
    .finally(() => { session.close() })
}

exports.approve_application = (req, res, next) => {

  // TODO: prevent re-approval

  const application_id = get_application_id(req)
  if(!application_id) throw createError(400, 'Application ID not defined')

  const {
    attachment_hankos,
    comment = '',
  } = req.body

  let attachment_hankos_query = ``
  if(attachment_hankos) {
    attachment_hankos_query = `SET approval.attachment_hankos = $attachment_hankos`
  }

  const query = `
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
    WHERE application._id = $application_id
      AND recipient._id = $user_id

    // TODO: Add check if flow is respected

    // Mark as approved
    WITH application, recipient
    MERGE (application)<-[approval:APPROVED]-(recipient)
    SET approval.date = date()
    SET approval.comment = $comment
    SET approval._id = randomUUID()
    ${attachment_hankos_query}

    RETURN approval, recipient, application
    `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
    comment,
    uuid: uuidv4(),
    attachment_hankos: JSON.stringify(attachment_hankos), // Neo4J does not support nested props so convert to string
  }


  const session = driver.session()
  session.run(query, params)
    .then(({records}) => {

      if(!records.length) throw createError(404, `Application ${application_id} not found`)

      const approval = records[0].get('approval')
      console.log(`Application ${approval.properties._id} got approved by user ${records[0].get('recipient').properties._id}`)
      res.send(approval)
    })
    .catch(next)
    .finally(() => { session.close() })

}

exports.reject_application = (req, res, next) => {
  // basically the opposite of putting a hanko

  const application_id = get_application_id(req)

  if(!application_id) throw createError(400, 'Application ID not defined')

  const {comment = ''} = req.body

  const session = driver.session()

  const query = `
    // TODO: USE QUERIES FROM UTILS
    // Find the application and get oneself at the same time
    MATCH (application:ApplicationForm)-[submission:SUBMITTED_TO]->(recipient:User)
    WHERE application._id = $application_id
      AND recipient._id = $user_id

    // TODO: Add check if flow is respected
    // Working fine without apparently

    // Mark as REJECTED
    WITH application, recipient
    MERGE (application)<-[rejection:REJECTED]-(recipient)
    SET rejection._id = randomUUID()
    SET rejection.date = date()
    SET rejection.comment = $comment

    // RETURN APPLICATION
    RETURN application, recipient, rejection`

  const params = {
    user_id: get_current_user_id(res),
    application_id,
    comment,
  }

  session
    .run(query, params)
    .then(({records}) => {

      if(!records.length) throw createError(404, `Application ${application_id} not found`)

      const application = records[0].get('application').identity
      res.send(records[0].get('rejection'))
      console.log(`Application ${application.properties._id} got rejected by user ${records[0].get('recipient').properties._id}`)
    })
    .catch(next)
    .finally(() => { session.close() })

}

exports.update_privacy_of_application = (req, res, next) => {
  // Riute to make an application confidential or public

  let application_id = get_application_id(req)

  if(!application_id) throw createError(400, 'Application ID not defined')

  const session = driver.session()

  const query = `
    // Find the application
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(applicant:User)
    WHERE application._id = $application_id
      AND applicant._id = $user_id

    // Set the privacy property
    SET application.private = $private

    // Return the application
    RETURN application
    `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
    private: req.body.private,
  }

  session
    .run(query, params)
    .then(({records}) => {
      if(!records.length) throw createError(404, `Application ${application_id} not found`)
      const application = records[0].get('application')
      res.send(application)
     })
    .catch(next)
    .finally(() => { session.close() })

}

exports.update_application_visibility = (req, res) => {
  // Deletes all relationships to groups and recreate them

  const application_id = get_application_id(req)

  if(!application_id) throw createError(400, 'Application ID not defined')

  const session = driver.session()

  const query = `
    // Find the application
    // Only the applicant can make the update
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(user:User)
    WHERE application._id = $application_id
      AND applicant._id = $user_id

    // delete all visibility relationships
    WITH application
    MATCH (application)-[rel:VISIBLE_TO]->(:Group)
    DELETE rel

    // Now recreate all relationships
    WITH application
    UNWIND
      CASE
        WHEN $group_ids = []
          THEN [null]
        ELSE $group_ids
      END AS group_id

    OPTIONAL MATCH (group:Group)
    WHERE group._id =group_id
    WITH collect(group) as groups, application
    FOREACH(group IN groups | MERGE (application)-[:VISIBLE_TO]->(group))

    // Return the application
    RETURN application, group
    `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
    group_ids: req.body.group_ids,
  }
  session
    .run(query,params)
    .then( ({records}) => {
      if(!records.length) throw createError(404, `Application ${application_id} not found`)
      res.send(records[0].get('application'))
    })
    .catch(next)
    .finally(() => { session.close() })
}


exports.make_application_visible_to_group = (req, res, next) => {

  // Deletes all relationships to groups and recreate them

  const application_id = get_application_id(req)
  const {group_id} = req.body

  if(!application_id) throw createError(400, 'Application ID not defined')
  if(!group_id) throw createError(400, 'Group ID not defined')

  const session = driver.session()

  const query = `
    // Find the application
    // Only the applicant can make the update
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(applicant:User)
    WHERE application._id = $application_id
      AND applicant._id = $user_id

    // Find the group
    WITH application
    MATCH (group:Group)
    WHERE group._id = $group_id

    // Create the application
    MERGE (application)-[:VISIBLE_TO]->(group)

    // Return the application
    RETURN application, group
    `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
    group_id: req.body.group_id,
  }

  session
    .run(query,params)
    .then( ({records}) => {
      if(!records.length) throw createError(404, `Application ${application_id} not found`)
      res.send(records[0].get('application'))
    })
    .catch(next)
    .finally(() => { session.close() })
}

exports.remove_application_visibility_to_group = (req, res, next) => {

  const application_id = get_application_id(req)
  const { group_id } = req.query

  if(!group_id) throw createError(400, 'Group ID not defined')
  if(!application_id) throw createError(400, 'Application ID not defined')

  const session = driver.session()

  const query = `
    // Find the application
    // Only the applicant can make the update
    MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(applicant:User)
    WHERE application._id = $application_id
      AND applicant._id = $user_id

    // Find the group
    WITH application
    MATCH (application)-[rel:VISIBLE_TO]->(group)
    WHERE group._id = $group_id

    // delete the relationship
    DELETE rel

    // Return the application
    RETURN application
    `

  const params = {
    user_id: get_current_user_id(res),
    application_id,
    group_id,
  }

  session
    .run(query, params)
    .then(({records}) => {
      if(!records.length) throw createError(404, `Application ${application_id} not found`)
      const application = records[0].get('application')
      res.send(application)
     })
    .catch(next)
    .finally(() => { session.close() })
}
