const { driver } = require("../db.js")
const { get_current_user_id } = require("../utils.js")
const createHttpError = require("http-errors")

exports.mark_recipient_as_notified = async (req, res) => {
  const session = driver.session()

  try {
    const { recipient_id, application_id } = req.params

    const current_user_id = get_current_user_id(res)

    // TODO: consider saving notifications for applicant too
    // WARNING: applicant can be recipient at the same time
    const cypher = `
      // Find current user for access control
      MATCH (currentUser:User {_id: $current_user_id})
      WITH currentUser

      MATCH (recipient:User {_id: $recipient_id} )<-[submission:SUBMITTED_TO]-(application:ApplicationForm {_id: $application_id})

      // Only allow recipient or applicant to perform operation
      WHERE (currentUser)<-[:SUBMITTED_TO]-(application:ApplicationForm)
        OR (currentUser)<-[:SUBMITTED_BY]-(application:ApplicationForm)
        
      SET submission.notified = true

      RETURN PROPERTIES(submission) as submission
      `

    const params = {
      current_user_id,
      recipient_id,
      application_id,
    }

    const { records } = await session.run(cypher, params)
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`)

    const submission = records[0].get("submission")
    console.log(
      `User ${recipient_id} notified of application ${application_id}`
    )
    res.send(submission)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
