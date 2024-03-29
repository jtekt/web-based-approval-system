const createHttpError = require("http-errors")
const { get_current_user_id } = require("../utils.js")
const { driver } = require("../db.js")

exports.update_comment = async (req, res, next) => {
  const session = driver.session()

  try {
    const { application_id } = req.params
    const { comment } = req.body
    const user_id = get_current_user_id(res)

    if (!application_id) throw createHttpError(400, `Missing application_id`)
    if (!comment) throw createHttpError(400, `Missing comment`)

    const cypher = `
      // Find current user to check for authorization
      // WARNING: decision could be SUBMITTED_BY or SUBMITTED_TO couldn't it?
      MATCH (user:User)-[decision]->(application:ApplicationForm)
      WHERE user._id = $user_id
      AND application._id = $application_id

      // Set the attached hankos
      SET decision.comment = $comment

      // Return
      RETURN decision.comment as comment
      `

    const params = {
      user_id,
      application_id,
      comment,
    }

    const { records } = await session.run(cypher, params)
    if (!records.length)
      throw createHttpError(
        404,
        `Application ${application_id} has no comment candidate for user ${user_id}`
      )
    console.log(
      `Comment on application ${application_id} by user ${user_id} updated`
    )
    res.send({ comment: records[0].get("comment") })
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
