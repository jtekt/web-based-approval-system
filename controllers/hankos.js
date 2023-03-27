const { driver } = require("../db.js")
const { get_current_user_id } = require("../utils.js")
const createHttpError = require("http-errors")

exports.update_hankos = async (req, res, next) => {
  const session = driver.session()

  try {
    const user_id = get_current_user_id(res)
    const { application_id } = req.params
    const { attachment_hankos } = req.body

    if (!attachment_hankos)
      throw createHttpError(400, "attachment_hankos not defined")

    const cypher = `
            MATCH (user:User)-[approval:APPROVED]->(application:ApplicationForm)
            WHERE user._id = $user_id
                AND application._id = $application_id

            SET approval.attachment_hankos = $attachment_hankos

            RETURN PROPERTIES(approval) as approval
            `

    const params = {
      user_id,
      application_id,
      attachment_hankos: JSON.stringify(attachment_hankos),
    }

    const { records } = await session.run(cypher, params)
    if (!records.length)
      throw createHttpError(404, `Application ${application_id} not found`)

    const approval = records[0].get("approval")
    console.log(`Hankos of approval ${approval._id} updated by user ${user_id}`)
    res.send(approval)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
