const {driver} = require('../../db.js')

const {
  get_current_user_id,
  error_handling,
  filter_by_user_id,
} = require('../../utils.js')



exports.update_attachment_hankos = (req, res) => {

  const {approval_id} = req.params

  console.log(approval_id)

  var session = driver.session()
  session
  .run(`
    // Find current user to check for authorization
    MATCH (user:User)-[approval:APPROVED]->(application:ApplicationForm)
    ${filter_by_user_id}
      AND approval._id = $approval_id

    // Set the attached hankos
    SET approval.attachment_hankos = $attachment_hankos

    // Return
    RETURN application, approval

    `, {
    user_id: get_current_user_id(res),
    approval_id,
    attachment_hankos: JSON.stringify(req.body.attachment_hankos), // Neo4J does not support nested props so convert to string
  })
  .then(result => {
    res.send(result.records)
    console.log(`Attached hankos of approval ${approval_id} updated`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error accessing DB: ${error}`)
  })
  .finally(() => { session.close() })

}
