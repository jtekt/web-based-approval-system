const {driver} = require('../../db.js')
const {
  get_current_user_id,
  error_handling,
  application_batching,
  return_application_and_related_nodes,
  format_application_from_record,
  query_submitted_rejected_applications,
  query_submitted_pending_applications,
  query_submitted_approved_applications,
  query_received_pending_applications,
  query_received_rejected_applications,
  query_received_approved_applications,
  filter_by_type,
  query_with_hanko_id,
  query_with_application_id,
  query_with_date,
  query_with_group,
  query_deleted,
  query_with_relationship_and_state,
} = require('../../utils.js')







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
