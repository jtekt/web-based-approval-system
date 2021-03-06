const createError = require('http-errors')
const {driver} = require('../../db.js')
const {
  get_current_user_id,
  get_application_id,
  filter_by_user_id,
} = require('../../utils.js')


exports.update_comment = (req, res, next) => {

  const {decision_id} = req.params
  const {comment} = req.body
  const user_id = get_current_user_id(res)

  if(!decision_id) throw createError(400, `Missing decision_id`)
  if(!comment) throw createError(400, `Missing comment`)

  const session = driver.session()

  const query = `

    // Find current user to check for authorization
    MATCH (user:User)-[decision]->(application:ApplicationForm)
    ${filter_by_user_id}
      AND decision._id = $decision_id

    // Set the attached hankos
    SET decision.comment = $comment

    // Return
    RETURN decision
    `

  const params = {
    user_id,
    decision_id,
    comment,
  }

  session.run(query,params)
  .then( ({records}) => {
    if(!records.length) throw createError(404, `Decision ${decision_id} of user ${user_id} not found`)
    const decision = records[0].get('decision')
    res.send(decision)
    console.log(`Comment of decision ${decision_id} updated`)
  })
  .catch(next)
  .finally(() => { session.close() })
}
