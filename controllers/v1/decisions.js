const driver = require('../../neo4j_driver.js')

const visibility_enforcement = `
  WITH user, application
  WHERE NOT application.private
    OR NOT EXISTS(application.private)
    OR (application)-[:SUBMITTED_BY]->(user)
    OR (application)-[:SUBMITTED_TO]->(user)
    OR (application)-[:VISIBLE_TO]->(:Group)<-[:BELONGS_TO]-(user)
`

function get_current_user_id(res) {
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}

function get_application_id(req) {
  return req.params.application_id
    ?? req.body.application_id
    ?? req.body.id
    ?? req.query.application_id
    ?? req.query.id
}

exports.update_comment = (req, res) => {

  const {decision_id} = req.params
  const {comment} = req.body
  const user_id = get_current_user_id(res)

  if(!comment) return res.status(400).send(`Missing comment`)

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:User)-[decision]->(application:ApplicationForm)
    WHERE id(user) = toInteger($user_id)
      AND id(decision) = toInteger($decision_id)

    // Set the attached hankos
    SET decision.comment = $comment

    // Return
    RETURN decision

    `, {
    user_id,
    decision_id,
    comment,

  })
  .then( (result) => {
    res.send(result.records)
    console.log(`Comment of decision ${decision_id} updated`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })
}
