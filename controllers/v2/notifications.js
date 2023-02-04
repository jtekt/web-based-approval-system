const { driver } = require("../../db.js")
const { get_current_user_id } = require("../../utils.js")
const createHttpError = require("http-errors")

exports.mark_recipient_as_notified = async (req, res, next) => {
  console.log("HERE???")
  const session = driver.session()

  try {
    const { recipient_id, application_id } = req.params

    // TODO: Prevent unrelated users from marking submission as notified
    //   const current_user_id = get_current_user_id(res)

    const cypher = `
            MATCH (recipient:User)<-[submission:SUBMITTED_TO]-(application:ApplicationForm)
            WHERE recipient._id = $recipient_id
                AND application._id = $application_id

            SET submission.notified = true

            RETURN PROPERTIES(submission) as submission
            `

    const params = {
      recipient_id,
      application_id,
    }

    const { records } = await session.run(cypher, params)
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`)

    const submission = records[0].get("submission")
    console.log(
      `User ${recipient_id._id} notified of application ${application_id}`
    )
    res.send(submission)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
